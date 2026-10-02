import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';

/**
 * 评论服务层
 * ------------------------------------------------------------
 * 三条设计原则（答辩可直接讲）：
 *
 * 1. 【先审后发】游客留言一律存成 PENDING（待审核），
 *    只有 APPROVED 才会出现在公开接口里。
 *    这是内容型网站防垃圾评论最省事的办法 —— 不需要买风控服务，
 *    把"是否公开"做成一个状态字段就够了。
 *
 * 2. 【邮箱不公开】公开接口的 select 里刻意没有 email。
 *    游客填邮箱只是为了站长能联系/识别，它不是公开信息。
 *    这是最小暴露原则：接口只返回调用方真正需要的字段。
 *    （对比：后台接口 ADMIN_FIELDS 里才有 email）
 *
 * 3. 【站长回复走同一个接口】游客和站长用的是同一个 POST 接口，
 *    靠 optionalAuth 中间件区分身份：带 token 就是站长回复。
 *    站长的昵称/邮箱不从请求体里取，而是**按 userId 回查数据库** ——
 *    不信任前端提交的身份信息，这是鉴权的基本原则。
 */

export interface CommentListQuery {
  page?: number;
  pageSize?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface CreateCommentInput {
  slug: string;
  nickname: string;
  email: string;
  content: string;
  /** 站长回复标记：由 controller 依据 token 决定，前端传什么都不算 */
  isAuthor?: boolean;
  userId?: number;
}

/** 公开字段 —— 注意这里**没有 email** */
const PUBLIC_FIELDS = {
  id: true,
  content: true,
  nickname: true,
  isAuthor: true,
  createdAt: true,
} as const;

/** 后台字段 —— 站长要看得到邮箱，还要知道评论挂在哪篇文章下 */
const ADMIN_FIELDS = {
  id: true,
  content: true,
  nickname: true,
  email: true,
  status: true,
  isAuthor: true,
  createdAt: true,
  article: { select: { id: true, title: true, slug: true } },
} as const;

/** 分页参数统一收口，避免每个函数各写一套边界判断 */
function normalizePage(q: CommentListQuery, defaultSize = 20) {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(q.pageSize) || defaultSize));
  return { page, pageSize };
}

/**
 * 只有"已发布"的文章才能有评论。
 * 草稿对游客本来就不存在（详情页返回 404），评论接口必须保持一致，
 * 否则会变成一个侧信道：通过评论接口的返回码能探测出草稿是否存在。
 */
async function requirePublishedArticleId(slug: string): Promise<number> {
  const article = await prisma.article.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });

  if (!article || article.status !== 'PUBLISHED') {
    throw AppError.notFound('文章不存在');
  }
  return article.id;
}

/** 某篇文章下的评论（公开）—— 只返回已审核通过的 */
export async function listPublicComments(slug: string, q: CommentListQuery = {}) {
  const articleId = await requirePublishedArticleId(slug);
  const { page, pageSize } = normalizePage(q, 10);

  // 只用 articleId + status 两个条件，正好命中 schema 里的
  // @@index([articleId, status]) 复合索引，数据量大了也不会全表扫描
  const where: Prisma.CommentWhereInput = { articleId, status: 'APPROVED' };

  const [total, rows] = await prisma.$transaction([
    prisma.comment.count({ where }),
    prisma.comment.findMany({
      where,
      select: PUBLIC_FIELDS,
      // 评论按时间正序：像对话一样从上往下读，符合直觉
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

/** 发评论（游客留言 or 站长回复） */
export async function createComment(input: CreateCommentInput) {
  const articleId = await requirePublishedArticleId(input.slug);
  const isAuthor = input.isAuthor === true;

  let nickname = input.nickname.trim();
  let email = input.email.trim();

  // 站长回复：身份以数据库为准，忽略请求体里的昵称/邮箱
  if (isAuthor && input.userId) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { username: true, nickname: true, email: true },
    });
    if (!user) throw AppError.unauthorized('账号不存在，请重新登录');

    nickname = (user.nickname ?? '').trim() || user.username;
    email = user.email;
  }

  return prisma.comment.create({
    data: {
      content: input.content.trim(),
      nickname,
      email,
      articleId,
      userId: isAuthor ? (input.userId ?? null) : null,
      isAuthor,
      // ★ 关键的一行：站长回复直接过审，游客留言一律待审核
      status: isAuthor ? 'APPROVED' : 'PENDING',
    },
    // 返回值里带上 status，前端据此提示"已发布"还是"待审核"
    select: { ...PUBLIC_FIELDS, status: true },
  });
}

/** 后台：全站评论列表（含待审核），可按状态筛选 */
export async function listAdminComments(q: CommentListQuery = {}) {
  const { page, pageSize } = normalizePage(q);
  const where: Prisma.CommentWhereInput = q.status ? { status: q.status } : {};

  const [total, rows, pendingCount] = await prisma.$transaction([
    prisma.comment.count({ where }),
    prisma.comment.findMany({
      where,
      select: ADMIN_FIELDS,
      // 后台反过来：最新的在最上面，方便处理刚收到的留言
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    // 待审核总数单独算一次，用来在页签上显示小红点
    prisma.comment.count({ where: { status: 'PENDING' } }),
  ]);

  return {
    items: rows,
    pendingCount,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

/** 后台：审核（通过 / 拒绝 / 打回待审） */
export async function updateCommentStatus(
  id: number,
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
) {
  const existing = await prisma.comment.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw AppError.notFound('评论不存在');

  return prisma.comment.update({ where: { id }, data: { status }, select: ADMIN_FIELDS });
}

/** 后台：删除评论 */
export async function deleteComment(id: number) {
  const existing = await prisma.comment.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw AppError.notFound('评论不存在');

  await prisma.comment.delete({ where: { id } });
  return true;
}
