import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { generateSlug } from '../utils/auth';

/**
 * 文章服务层
 * ------------------------------------------------------------
 * 这是系统的核心业务。几个设计要点：
 *
 * 1. 列表查询用 select 而不是 include
 *    include 会把 content（Markdown 原文，几十 KB）也查出来。
 *    列表页根本不需要正文，只显示标题和摘要。
 *    加上 select 只取必要字段，一页 10 篇能省下几百 KB 传输。
 *    这是最容易被忽视的性能优化点。
 *
 * 2. 分页用 skip/take
 *    offset 分页在数据量大时有性能问题（要扫过前 N 条），
 *    但博客量级（几百篇）完全够用，且能跳页。
 *    如果是百万级数据才需要换成游标分页（cursor-based）。
 *
 * 3. 标签是显式中间表
 *    创建文章时用嵌套 create 一次性写入关联，
 *    由 Prisma 在一个事务里完成，不用手动 begin/commit。
 */

export interface ArticleListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categorySlug?: string;
  tagSlug?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  includeAllStatus?: boolean;
}

/** 列表用的字段集 —— 刻意不含 content */
const LIST_FIELDS = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  coverImage: true,
  status: true,
  viewCount: true,
  isTop: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, username: true, nickname: true, avatar: true } },
  category: { select: { id: true, name: true, slug: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} as const;

/**
 * 组装查询条件
 * 抽成独立函数是因为「列表查询」和「总数统计」必须用完全相同的条件，
 * 否则会出现「第 2 页显示 3 条但总数说有 25 条」这类分页错乱。
 */
function buildWhere(q: ArticleListQuery) {
  const where: Record<string, unknown> = {};

  // 前台只能看到已发布的；后台可以看全部
  if (!q.includeAllStatus) {
    where.status = q.status ?? 'PUBLISHED';
  } else if (q.status) {
    where.status = q.status;
  }

  if (q.keyword) {
    where.OR = [
      { title: { contains: q.keyword } },
      { summary: { contains: q.keyword } },
    ];
  }

  if (q.categorySlug) {
    where.category = { slug: q.categorySlug };
  }

  if (q.tagSlug) {
    where.tags = { some: { tag: { slug: q.tagSlug } } };
  }

  return where;
}

export async function listArticles(q: ArticleListQuery) {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(q.pageSize) || 10));
  const where = buildWhere(q);

  // $transaction 让两条查询走同一个事务快照，
  // 避免"查数据"和"查总数"之间刚好有人插了一篇文章导致总数对不上
  const [total, rows] = await prisma.$transaction([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      select: LIST_FIELDS,
      // 置顶优先，然后按发布时间倒序
      orderBy: [{ isTop: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(normalizeTags),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/** 把 [{tag:{...}}] 压平成 [{...}]，前端用起来更顺手 */
function normalizeTags<T extends { tags?: unknown }>(row: T) {
  const tags = Array.isArray(row.tags)
    ? (row.tags as Array<{ tag: unknown }>).map((t) => t.tag)
    : [];
  return { ...row, tags };
}

/**
 * 文章详情（含正文）
 * side effect：顺手把浏览量 +1
 */
export async function getArticleBySlug(slug: string, isAdmin = false) {
  const article = await prisma.article.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, username: true, nickname: true, avatar: true } },
      category: { select: { id: true, name: true, slug: true } },
      tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
    },
  });

  if (!article) throw AppError.notFound('文章不存在');

  // 未发布的文章只有管理员能看 —— 越权访问防护
  if (article.status !== 'PUBLISHED' && !isAdmin) {
    throw AppError.notFound('文章不存在');
  }

  // 浏览量 +1。用 update 的 increment 而不是先读后写，
  // 因为后者在并发下会丢失更新（两个人同时读 100，都写 101，实际应该是 102）
  if (!isAdmin) {
    await prisma.article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });
  }

  return normalizeTags(article);
}

export interface CreateArticleInput {
  title: string;
  content: string;
  summary?: string;
  coverImage?: string;
  categoryId?: number;
  tagIds?: number[];
  status?: 'DRAFT' | 'PUBLISHED';
  isTop?: boolean;
  authorId: number;
}

export async function createArticle(input: CreateArticleInput) {
  const slug = generateSlug(input.title);

  const article = await prisma.article.create({
    data: {
      title: input.title,
      slug,
      content: input.content,
      summary: input.summary ?? input.content.slice(0, 150).replace(/[#*`>\-\n]/g, ' ').trim(),
      coverImage: input.coverImage,
      categoryId: input.categoryId ?? null,
      status: input.status ?? 'DRAFT',
      isTop: input.isTop ?? false,
      // 只有发布状态才写 publishedAt，草稿保持为 null
      publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
      authorId: input.authorId,
      // 嵌套写入标签关联，Prisma 会自动处理中间表
      tags: input.tagIds?.length
        ? { create: input.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
    include: {
      category: true,
      tags: { include: { tag: true } },
    },
  });

  return normalizeTags(article);
}

export async function updateArticle(
  id: number,
  input: Partial<CreateArticleInput>
) {
  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('文章不存在');

  const article = await prisma.article.update({
    where: { id },
    data: {
      title: input.title,
      content: input.content,
      summary: input.summary,
      coverImage: input.coverImage,
      categoryId: input.categoryId,
      status: input.status,
      isTop: input.isTop,
      // 从草稿变成已发布时补上发布时间；已经是发布状态则不动（保留首次发布时间）
      publishedAt:
        input.status === 'PUBLISHED' && !existing.publishedAt
          ? new Date()
          : undefined,
      // 标签是全量覆盖：先清空再重建。
      // 用 deleteMany + create 而不是逐个 diff，逻辑简单且在一个事务内。
      tags: input.tagIds
        ? { deleteMany: {}, create: input.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
    include: {
      category: true,
      tags: { include: { tag: true } },
    },
  });

  return normalizeTags(article);
}

export async function deleteArticle(id: number) {
  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('文章不存在');

  // 关联的 article_tags 由数据库外键的 ON DELETE CASCADE 自动清理，
  // 这就是在 schema 里写 onDelete: Cascade 的作用
  await prisma.article.delete({ where: { id } });
  return true;
}

/**
 * 归档 / 恢复
 */
export async function toggleArchive(id: number) {
  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('文章不存在');

  return prisma.article.update({
    where: { id },
    data: { status: existing.status === 'ARCHIVED' ? 'PUBLISHED' : 'ARCHIVED' },
  });
}

/**
 * 站点统计 —— 首页和后台仪表盘都要用
 */
export async function getStats() {
  const [articleCount, publishedCount, categoryCount, tagCount, viewSum] =
    await prisma.$transaction([
      prisma.article.count(),
      prisma.article.count({ where: { status: 'PUBLISHED' } }),
      prisma.category.count(),
      prisma.tag.count(),
      prisma.article.aggregate({ _sum: { viewCount: true } }),
    ]);

  return {
    articleCount,
    publishedCount,
    draftCount: articleCount - publishedCount,
    categoryCount,
    tagCount,
    totalViews: viewSum._sum.viewCount ?? 0,
  };
}
