import request from './request';

// ---- 类型定义（和后端返回一一对应）----

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  coverImage: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  viewCount: number;
  isTop: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: number;
    username: string;
    nickname: string | null;
    avatar: string | null;
  };
  category: Category | null;
  tags: Tag[]; // 后端已压平，直接是数组
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ⚠️ 后端实际契约：data 直接是数组，pagination 与它同级
export interface ArticleListResult {
  success: boolean;
  data: Article[];
  pagination: Pagination;
}

export interface ArticleDetailResult {
  success: boolean;
  data: Article & { content: string };
}

// ---- 接口函数 ----

export interface ListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  category?: string;
  tag?: string;
}

/** 文章列表（只返回已发布的） */
export function fetchArticles(params: ListParams = {}) {
  return request.get<unknown, ArticleListResult>('/posts', { params });
}

/** 文章详情（含正文） */
export function fetchArticleBySlug(slug: string) {
  return request.get<unknown, ArticleDetailResult>(`/posts/${slug}`);
}

/** 分类列表 */
export function fetchCategories() {
  return request.get<unknown, { success: boolean; data: Category[] }>('/categories');
}

/** 标签列表 */
export function fetchTags() {
  return request.get<unknown, { success: boolean; data: Tag[] }>('/tags');
}
