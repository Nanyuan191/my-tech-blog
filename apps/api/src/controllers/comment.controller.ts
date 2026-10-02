import type { Request, Response } from 'express';
import { z } from 'zod';
import * as commentService from '../services/comment.service';
import { AppError } from '../middlewares/errorHandler';

/**
 * 评论控制器
 * ------------------------------------------------------------
 * 和文章控制器保持一致的分工：只做「校验入参 → 调 service → 组装响应」。
 */

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

const statusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
});

/**
 * 两种提交者，两套校验规则：
 *   游客 → 必须自报昵称 + 邮箱（服务端没有"人"的概念，只能靠自报）
 *   站长 → 只提交正文即可，昵称/邮箱由服务端按 token 里的 userId 回查
 *
 * .trim() 写在 .min(1) 之前，所以"只输入空格"会被判为空 —— 这是有意为之。
 */
const guestSchema = z.object({
  nickname: z.string().trim().min(1, '请填写昵称').max(32, '昵称最多 32 个字'),
  email: z.string().trim().email('邮箱格式不正确').max(191),
  content: z.string().trim().min(1, '评论内容不能为空').max(1000, '评论最多 1000 字'),
});

const authorSchema = z.object({
  content: z.string().trim().min(1, '回复内容不能为空').max(1000, '回复最多 1000 字'),
});

/** 某篇文章下的评论（公开，无需登录） */
export async function listByPost(req: Request, res: Response) {
  const slug = req.params.slug;
  if (!slug) throw AppError.badRequest('缺少文章标识');

  const q = pageQuerySchema.parse(req.query);
  const result = await commentService.listPublicComments(slug, q);

  res.json({ success: true, data: result.items, pagination: result.pagination });
}

/**
 * 发评论（可选登录）
 * ------------------------------------------------------------
 * 同一个接口两种身份，靠 optionalAuth 中间件区分：
 *   无 token → 游客留言，入库 PENDING，需要站长审核
 *   有 token → 站长回复，入库即 APPROVED，并且打上 isAuthor 徽章
 */
export async function create(req: Request, res: Response) {
  const slug = req.params.slug;
  if (!slug) throw AppError.badRequest('缺少文章标识');

  const isAdmin = !!req.user && ['ADMIN', 'EDITOR'].includes(req.user.role);
  const parsed = (isAdmin ? authorSchema : guestSchema).safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest(parsed.error.issues[0]?.message ?? '参数不合法');
  }

  // 两套 schema 的字段不完全一样，这里取"两者都有"的部分
  const body = parsed.data as { nickname?: string; email?: string; content: string };

  const data = await commentService.createComment({
    slug,
    content: body.content,
    nickname: body.nickname ?? '',
    email: body.email ?? '',
    isAuthor: isAdmin,
    userId: isAdmin && req.user ? req.user.sub : undefined,
  });

  res.status(201).json({ success: true, data });
}

// ---- 后台接口（路由层已统一挂 requireAuth）----

/** 全站评论列表（含待审核） */
export async function adminList(req: Request, res: Response) {
  const q = pageQuerySchema.parse(req.query);
  const result = await commentService.listAdminComments(q);

  res.json({
    success: true,
    data: result.items,
    pagination: result.pagination,
    // 待审核总数与列表同级返回，前端页签的小红点直接用它
    pendingCount: result.pendingCount,
  });
}

/** 审核：通过 / 拒绝 / 打回 */
export async function updateStatus(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('评论 ID 不合法');

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest(parsed.error.issues[0]?.message ?? '参数不合法');
  }

  const data = await commentService.updateCommentStatus(id, parsed.data.status);
  res.json({ success: true, data });
}

/** 删除评论 */
export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('评论 ID 不合法');

  await commentService.deleteComment(id);
  res.json({ success: true, message: '删除成功' });
}
