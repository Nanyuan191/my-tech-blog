import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as commentController from '../controllers/comment.controller';
import { requireAuth, optionalAuth } from '../middlewares/auth';
import { wrap } from '../middlewares/errorHandler';

/**
 * 评论路由
 * ------------------------------------------------------------
 * 评论有两个"视角"，所以拆成两个 router，各自挂在不同前缀下：
 *
 *   postCommentRouter  → 挂 /api/posts     是文章的**子资源**
 *                        GET  /posts/:slug/comments
 *                        POST /posts/:slug/comments
 *   commentAdminRouter → 挂 /api/comments  是后台的**全局视角**
 *                        GET    /comments
 *                        PATCH  /comments/:id/status
 *                        DELETE /comments/:id
 *
 * 为什么不都塞进 article.ts？
 *   子资源（某篇文章下的评论）留在 /posts 下语义最清楚；
 *   但"审核全站评论"跟具体文章无关，挂在 /comments 更合理。
 *   拆开之后，权限边界也一眼可见：一个 router 全公开，一个整条 requireAuth。
 */

const postCommentRouter = Router();

/**
 * 留言限流 —— 评论是全站唯一「免登录 + 写数据库」的入口，最容易被脚本刷。
 * 策略：同一 IP 10 分钟最多 5 条。
 *
 * 注意 skip：站长（带有效 token）不受限制，
 * 否则回复几条就自己把自己限住了。所以限流必须放在 optionalAuth **之后**。
 */
const commentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  skip: (req) => Boolean(req.user),
  message: { success: false, message: '评论太频繁了，请 10 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 读评论：公开，只返回已审核通过的
postCommentRouter.get('/:slug/comments', wrap(commentController.listByPost));

// 发评论：optionalAuth（游客/站长同一个接口）→ 限流 → 业务
postCommentRouter.post(
  '/:slug/comments',
  optionalAuth,
  commentLimiter,
  wrap(commentController.create)
);

// ---- 后台：评论审核 ----
const commentAdminRouter = Router();
commentAdminRouter.use(requireAuth); // 一行搞定：这个 router 下全部要登录

commentAdminRouter.get('/', wrap(commentController.adminList));
commentAdminRouter.patch('/:id/status', wrap(commentController.updateStatus));
commentAdminRouter.delete('/:id', wrap(commentController.remove));

export { postCommentRouter, commentAdminRouter };
