import { Router } from 'express';
import * as articleController from '../controllers/article.controller';
import { requireAuth, optionalAuth } from '../middlewares/auth';
import { wrap } from '../middlewares/errorHandler';
import { postCommentRouter } from './comment';

/**
 * 文章路由
 * ------------------------------------------------------------
 * 这个文件是理解整个系统权限模型的最佳入口：
 *
 *   前台接口（公开）             后台接口（需登录）
 *   ├ GET    /posts             ├ GET    /posts/admin
 *   ├ GET    /posts/stats       ├ PATCH  /posts/admin/:id/archive
 *   ├ GET    /posts/:slug       │
 *   ├ POST   /posts             │  ← 写操作走前台资源路径 + requireAuth
 *   ├ PUT    /posts/:id         │     这样 REST 语义最干净
 *   └ DELETE /posts/:id         ┘
 *
 * 同一个资源、不同的访问路径，用中间件做隔离 —— 这就是最朴素的 RBAC。
 *
 * ⚠️ 路由注册顺序的坑（这条最容易踩）：
 *   Express 按注册顺序匹配，参数路径 /:slug 会吃掉任何单段路径。
 *   所以所有**固定路径**（/stats）必须写在 /:slug **前面**，
 *   否则请求 /posts/stats 时会被当成"查一篇 slug=stats 的文章"，返回 404。
 *   同理，写操作（POST / PUT / DELETE）也要注册在 /:slug 之前。
 */

// ============ 前台路由（公开） ============
const publicRouter = Router();

// ✅ 固定路径必须排在 /:slug 之前
publicRouter.get('/', wrap(articleController.list));
publicRouter.get('/stats', wrap(articleController.stats));

// ============ 写操作（需登录）============
// 挂在前台资源路径 /posts 上，只加 requireAuth 中间件：
//   POST   /api/posts      新建
//   PUT    /api/posts/:id  更新
//   DELETE /api/posts/:id  删除
// 同样必须在 /:slug 之前注册，否则 PUT /posts/3 会先撞上 /:slug。
publicRouter.post('/', requireAuth, wrap(articleController.create));
publicRouter.put('/:id', requireAuth, wrap(articleController.update));
publicRouter.delete('/:id', requireAuth, wrap(articleController.remove));

// 详情放最后：它是"万能兜底"式路由，必须让具体路径先匹配
// optionalAuth：带 token 时能预览未发布的草稿，不带 token 只能看已发布的。
publicRouter.get('/:slug', optionalAuth, wrap(articleController.detail));

// 点赞：公开接口（游客也能点），只加计数不需要登录。
// 路径两段式 /:slug/like，和上面的 /:slug 不冲突（段数不同），
// 但仍写在它后面保持一致的可读顺序。
publicRouter.post('/:slug/like', wrap(articleController.like));

// ============ 后台路由（需登录） ============
const adminRouter = Router();
adminRouter.use(requireAuth); // 一行搞定：这个 router 下所有接口都要登录

// ⚠️ 这里的 '/' 就是 /api/posts/admin（不是 /api/posts）
adminRouter.get('/', wrap(articleController.adminList));
adminRouter.patch('/:id/archive', wrap(articleController.toggleArchive));

// 把几个 router 合成一个导出，在 app.ts 里只需挂载一次
const articleRouter = Router();

// 评论子资源：/posts/:slug/comments（两段式路径，与 /:slug 不冲突）
// 放在 publicRouter 之前，语义上"更具体的路径优先"
articleRouter.use('/', postCommentRouter);
articleRouter.use('/admin', adminRouter);
articleRouter.use('/', publicRouter);

export { articleRouter };
