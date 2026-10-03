import type { Request, Response } from 'express';
import { z } from 'zod';
import * as articleService from '../services/article.service';
import { AppError } from '../middlewares/errorHandler';

/**
 * 文章控制器
 * ------------------------------------------------------------
 * 职责边界：只做三件事 —— 校验入参、调用 service、组装响应。
 * 不含任何业务规则（那些在 article.service.ts 里）。
 */

// ---- 入参校验 schema ----

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  keyword: z.string().max(100).optional(),
  category: z.string().max(64).optional(),
  tag: z.string().max(64).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  // 后台请求时带 all=1 表示要看到所有状态的文章
  all: z.string().optional(),
});

const createSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255),
  content: z.string().min(1, '正文不能为空').max(500_000),
  summary: z.string().max(512).optional(),
  coverImage: z.string().max(512).optional(),
  // 文章页背景图：短标识（bg:xxx）或外链 URL，空 = 默认洛克背景
  bgImage: z.string().max(512).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  tagIds: z.array(z.coerce.number().int().positive()).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  isTop: z.boolean().optional(),
});

const updateSchema = createSchema.partial(); // 所有字段变可选

/**
 * 为什么用 z.coerce.number()？
 * URL 查询参数和表单字段全都是字符串（?page=2）。
 * coerce 会自动把 "2" 转成 2，省去手写 Number() 转换。
 * 转换失败会返回校验错误，而不是变成 NaN 到处乱跑。
 */

// ---- 前台接口 ----

/** 文章列表（只返回已发布的） */
export async function list(req: Request, res: Response) {
  const q = listQuerySchema.parse(req.query);

  const result = await articleService.listArticles({
    page: q.page,
    pageSize: q.pageSize,
    keyword: q.keyword,
    categorySlug: q.category,
    tagSlug: q.tag,
    status: q.status,
    includeAllStatus: false,
  });

  res.json({ success: true, data: result.items, pagination: result.pagination });
}

/** 文章详情 */
export async function detail(req: Request, res: Response) {
  const slug = req.params.slug;
  if (!slug) throw AppError.badRequest('缺少文章标识');

  // 管理员可以预览未发布文章（req.user 由 requireAuth 填充，这里路由是可选的）
  const isAdmin = !!req.user && ['ADMIN', 'EDITOR'].includes(req.user.role);

  const article = await articleService.getArticleBySlug(slug, isAdmin);
  res.json({ success: true, data: article });
}

/**
 * 点赞 +1（公开接口，不需要登录）
 * 用 POST 而不是 GET：GET 语义是"只读"，而这里会改数据。
 * 浏览器预取、爬虫抓取都可能触发 GET —— 那是典型的"意料之外的写操作"。
 */
export async function like(req: Request, res: Response) {
  const slug = req.params.slug;
  if (!slug) throw AppError.badRequest('缺少文章标识');

  const data = await articleService.likeArticle(slug);
  res.json({ success: true, data });
}

// ---- 后台接口 ----

/** 后台文章列表（含草稿） */
export async function adminList(req: Request, res: Response) {
  const q = listQuerySchema.parse(req.query);

  const result = await articleService.listArticles({
    page: q.page,
    pageSize: q.pageSize,
    keyword: q.keyword,
    categorySlug: q.category,
    tagSlug: q.tag,
    status: q.status,
    includeAllStatus: true,
  });

  res.json({ success: true, data: result.items, pagination: result.pagination });
}

export async function create(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest(parsed.error.issues[0]?.message ?? '参数不合法');
  }
  if (!req.user) throw AppError.unauthorized('未登录');

  const article = await articleService.createArticle({
    ...parsed.data,
    authorId: req.user.sub,
  });

  res.status(201).json({ success: true, data: article });
}

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('文章 ID 不合法');

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest(parsed.error.issues[0]?.message ?? '参数不合法');
  }

  const article = await articleService.updateArticle(id, parsed.data);
  res.json({ success: true, data: article });
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('文章 ID 不合法');

  await articleService.deleteArticle(id);
  res.json({ success: true, message: '删除成功' });
}

export async function toggleArchive(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('文章 ID 不合法');

  const article = await articleService.toggleArchive(id);
  res.json({ success: true, data: article });
}

/** 站点统计 —— 首页/后台仪表盘 */
export async function stats(_req: Request, res: Response) {
  const data = await articleService.getStats();
  res.json({ success: true, data });
}
