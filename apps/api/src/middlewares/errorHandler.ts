/**
 * 全局错误处理与 404 兜底
 * ------------------------------------------------------------
 * 【核心代码详解 · 答辩重点之一】
 *
 * 问题：如果没有全局错误处理会怎样？
 *   Express 默认错误处理器会把完整堆栈直接返回给客户端。
 *   攻击者能从堆栈里读出：文件路径、依赖库版本、数据库表名……
 *   这是典型的信息泄露漏洞。
 *
 * 解决：自定义错误处理器统一接管，对外只返回"安全的错误信息"，
 *       完整堆栈只写进服务端日志。
 */
import type { Request, Response, NextFunction } from 'express';

import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * 业务错误类
 * 主动抛出的、可以安全展示给用户的错误（比如"文章不存在"、"密码错误"）
 * 与之相对的是"意外错误"（比如数据库连接断了），那些只能返回 500 通用提示
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'APP_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, message, 'BAD_REQUEST', details);
  }
  static unauthorized(message = '未登录或登录已过期'): AppError {
    return new AppError(401, message, 'UNAUTHORIZED');
  }
  static forbidden(message = '没有权限执行此操作'): AppError {
    return new AppError(403, message, 'FORBIDDEN');
  }
  static notFound(message = '资源不存在'): AppError {
    return new AppError(404, message, 'NOT_FOUND');
  }
  static conflict(message: string): AppError {
    return new AppError(409, message, 'CONFLICT');
  }
}

/**
 * 404 处理器
 * 注意：它只负责"没有匹配到任何路由"的情况，
 * 必须在所有业务路由注册之后、错误处理器之前注册。
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `接口不存在: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * 统一响应格式
 * 约定所有接口的响应分两种形态：
 *
 *   成功（HTTP 2xx）：
 *     { "success": true, "data": {...} }
 *     { "success": true, "data": [...], "pagination": {...} }   // 列表接口
 *
 *   失败（HTTP 4xx / 5xx）：
 *     { "code": "NOT_FOUND", "message": "文章不存在" }
 *
 * 统一格式的价值：前端拦截器可以用一套逻辑处理所有响应，
 * 不用为每个接口单独写解析代码。
 */

/**
 * 全局错误处理器
 * 【必须】保持 4 个参数。Express 靠参数个数来识别错误中间件，
 * 少一个参数它就会被当成普通中间件，错误就漏出去了。
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 情况一：我们自己主动抛的业务错误 → 可以安全地把 message 返回给用户
  if (err instanceof AppError) {
    logger.warn(`业务错误 ${err.statusCode} ${err.code}: ${err.message}`);
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  // 情况二：Prisma 的已知错误码 → 翻译成人话
  // P2002 = 唯一约束冲突（比如用户名重复）
  // P2025 = 记录不存在
  const prismaError = err as { code?: string; meta?: unknown };
  if (prismaError?.code === 'P2002') {
    logger.warn('唯一约束冲突:', prismaError.meta);
    res.status(409).json({ code: 'CONFLICT', message: '该记录已存在（唯一字段重复）' });
    return;
  }
  if (prismaError?.code === 'P2025') {
    res.status(404).json({ code: 'NOT_FOUND', message: '记录不存在' });
    return;
  }

  // 情况三：意外错误 → 完整堆栈只写日志，对外只给通用提示
  logger.error('未预期的服务器错误:', err);

  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: '服务器内部错误，请稍后重试',
    // 只有开发环境才把细节带出去，方便调试；生产环境绝不暴露
    ...(!env.isProd && err instanceof Error ? { stack: err.stack } : {}),
  });
}

/**
 * 异步路由包装器
 * ------------------------------------------------------------
 * 这是一个很实用的小技巧：
 *
 * 问题：Express 4 不会自动捕获 async 函数里 reject 的 Promise。
 *   如果你写 async (req, res) => { throw new Error() }，
 *   错误会变成 unhandledRejection，请求直接挂起直到超时。
 *
 * 解决：用一层 wrapper 把 catch 到的错误手动转交给 next()，
 *   这样全局错误处理器就能正常接管了。
 *
 * 用法：router.get('/', wrap(async (req, res) => { ... }))
 */
export function wrap<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: T, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
