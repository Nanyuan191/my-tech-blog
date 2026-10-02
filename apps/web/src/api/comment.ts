import request from './request';
import type { Pagination } from './article';

export type CommentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * 公开返回的评论
 * ⚠️ 注意这里**没有 email** —— 后端公开接口刻意不返回它。
 * 类型定义与后端契约保持一致，是"契约即文档"的体现：
 * 如果哪天后端不小心把 email 带出来，这里也不该跟着加。
 */
export interface Comment {
  id: number;
  content: string;
  nickname: string;
  isAuthor: boolean;
  createdAt: string;
}

/** 后台返回的评论：额外带 email 与所属文章 */
export interface AdminComment extends Comment {
  email: string;
  status: CommentStatus;
  article: { id: number; title: string; slug: string };
}

export interface CommentPageResult {
  success: boolean;
  data: Comment[];
  pagination: Pagination;
}

export interface AdminCommentPageResult {
  success: boolean;
  data: AdminComment[];
  pagination: Pagination;
  /** 待审核总数（页签小红点用） */
  pendingCount: number;
}

/** 写接口需要手动带 token —— request.ts 刻意不 import store，避免循环依赖 */
const authHeaders = (token: string | null) => ({ Authorization: `Bearer ${token}` });

/** 某篇文章下**已审核通过**的评论（公开，无需登录） */
export function fetchComments(slug: string, params: { page?: number; pageSize?: number } = {}) {
  return request.get<unknown, CommentPageResult>(`/posts/${slug}/comments`, { params });
}

/**
 * 发评论 —— 同一个接口，两种身份
 *   不带 token：游客留言 → 后端存为 PENDING，提示"待审核"
 *   带 token  ：站长回复 → 后端标记 isAuthor 并直接过审
 */
export function createComment(
  slug: string,
  payload: { nickname?: string; email?: string; content: string },
  token?: string | null
) {
  return request.post<unknown, { success: boolean; data: Comment & { status: CommentStatus } }>(
    `/posts/${slug}/comments`,
    payload,
    token ? { headers: authHeaders(token) } : undefined
  );
}

/** 后台：全站评论列表（含待审核），可按状态筛选 */
export function fetchAdminComments(
  params: { status?: CommentStatus; page?: number; pageSize?: number } = {},
  token: string | null = null
) {
  return request.get<unknown, AdminCommentPageResult>('/comments', {
    params,
    headers: authHeaders(token),
  });
}

/** 后台：审核（通过 / 拒绝 / 打回待审） */
export function updateCommentStatus(
  id: number,
  status: CommentStatus,
  token: string | null = null
) {
  return request.patch<unknown, { success: boolean; data: AdminComment }>(
    `/comments/${id}/status`,
    { status },
    { headers: authHeaders(token) }
  );
}

/** 后台：删除评论 */
export function deleteComment(id: number, token: string | null = null) {
  return request.delete<unknown, { success: boolean; message: string }>(`/comments/${id}`, {
    headers: authHeaders(token),
  });
}
