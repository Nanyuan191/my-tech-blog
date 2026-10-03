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
  likeCount: number;
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

/**
 * 新建分类（后台功能，需登录）
 * 后端 taxonomy.ts 里早就实现了 POST /categories，之前只是没有前端入口
 */
export function createCategory(name: string, token: string | null = null) {
  return request.post<unknown, { success: boolean; data: Category }>(
    '/categories',
    { name },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

/**
 * 新建标签（后台功能，需登录）
 * ⚠️ 注意：公开的 GET /tags 只返回「已有文章在用」的标签（articleCount > 0），
 * 所以刚创建、还没挂到文章上的标签在重新打开弹窗后会暂时消失 ——
 * 挂上文章后就一直显示了，这是后端有意设计的过滤，不是 Bug。
 */
export function createTag(name: string, token: string | null = null) {
  return request.post<unknown, { success: boolean; data: Tag }>(
    '/tags',
    { name },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

/**
 * 点赞（+1）
 * 注意用的是 POST：这个接口会改数据，不能用 GET。
 * 公开接口 —— 游客也能点，所以不需要带 token。
 */
export function likePost(slug: string) {
  return request.post<unknown, { success: boolean; data: { slug: string; likeCount: number } }>(
    `/posts/${slug}/like`
  );
}
