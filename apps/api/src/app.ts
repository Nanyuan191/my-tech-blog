/**
 * Express 应用装配（Express Application）
 * ------------------------------------------------------------
 * 这里是整个后端的"总装车间"。职责划分很关键：
 *
 *   server.ts  → 只负责"让应用监听端口"（进程生命周期）
 *   app.ts     → 只负责"装配中间件和路由"（应用逻辑）
 *
 * 为什么拆开？因为测试时只需要 app（用 supertest 直接调），
 * 不需要真的占用一个端口。这是 Express 项目的标准做法。
 *
 * 中间件顺序是有讲究的，从上到下就是请求的处理流水线：
 *   请求进来
 *     → helmet（加安全响应头）
 *     → cors（跨域，仅开发环境需要）
 *     → compression（压缩响应体）
 *     → json / urlencoded（解析请求体）
 *     → morgan（记访问日志）
 *     → 路由（业务逻辑）
 *     → 404 兜底
 *     → 全局错误处理
 *   响应出去
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { env } from './config/env';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { articleRouter } from './routes/article';
import { categoryRouter, tagRouter } from './routes/taxonomy';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler';

export function createApp(): express.Application {
  const app = express();

  // ---- 1. 安全响应头 ----
  // helmet 会设置一堆安全相关的 HTTP 头，比如 X-Content-Type-Options、
  // X-Frame-Options 等。它会顺手关掉 X-Powered-By，不暴露技术栈。
  app.use(helmet());

  // ---- 2. 跨域 ----
  // 开发时前端跑在 5173，后端跑在 3000，属于跨域。
  // 生产环境前端由 Nginx 提供、通过同域 /api 反代到后端，不存在跨域，
  // 所以这里只在非生产环境启用。
  if (!env.isProd) {
    app.use(
      cors({
        origin: env.CORS_ORIGIN,
        credentials: true,
      })
    );
  }

  // ---- 3. 响应压缩 ----
  // 对 JSON 响应做 gzip，文章列表这类文本内容能压掉 70% 以上
  app.use(compression());

  // ---- 4. 请求体解析 ----
  // 限制 1MB 是防滥用：Markdown 原文一般几百 KB 以内足够
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ---- 4.5 Cookie 解析 ----
  // refresh token 存在 httpOnly Cookie 里，需要它把 Cookie 解析到 req.cookies。
  // 没有这个中间件，req.cookies 就是 undefined，"无感刷新"直接失效。
  app.use(cookieParser());

  // ---- 5. 访问日志 ----
  // dev 格式是彩色的单行日志；生产建议用 combined（Apache 风格）
  app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // ---- 6. 路由挂载 ----
  // 所有接口统一前缀 /api，这样反代规则可以写得很干净：
  //   /       → 前端静态资源
  //   /api/*  → 后端服务
  app.use('/api/health', healthRouter);      // 存活探针
  app.use('/api/auth', authRouter);          // 登录 / 刷新 / 登出 / 当前用户
  app.use('/api/posts', articleRouter);      // 文章（含 /admin 子路径）
  app.use('/api/categories', categoryRouter);// 分类
  app.use('/api/tags', tagRouter);           // 标签

  // ---- 7. 404 兜底 ----
  // 放在所有路由之后。注意：Express 的中间件是按注册顺序匹配的，
  // 如果把 404 放在路由前面，正常请求也会被它截胡。
  app.use(notFoundHandler);

  // ---- 8. 全局错误处理 ----
  // 必须是 4 个参数（err, req, res, next）的中间件，Express 靠参数个数识别它。
  // 放在最后，用来兜住所有路由里 throw 出来的异常，
  // 保证不会把堆栈信息泄露给客户端。
  app.use(errorHandler);

  return app;
}
