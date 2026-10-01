import type { Request, Response, NextFunction } from 'express';
import { verifyToken, extractBearerToken, type AuthPayload } from '../utils/auth';
import { AppError } from './errorHandler';

/**
 * 鉴权中间件：校验 Authorization: Bearer <token>
 *
 * 通过后把用户信息挂到 req.user，后续 controller 直接用。
 * 用 TypeScript 的声明合并（declare global）给 Request 加字段，
 * 这样 req.user 有完整类型提示，而不是 any。
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    next(AppError.unauthorized('缺少访问令牌'));
    return;
  }

  try {
    const payload = verifyToken(token);

    // refresh token 不能当 access token 用 —— 这是常见的安全漏洞
    // （两个 token 用同一个密钥签名，必须靠 type 字段区分用途）
    if (payload.type !== 'access') {
      next(AppError.unauthorized('令牌类型不正确'));
      return;
    }

    req.user = payload;
    next();
  } catch {
    next(AppError.unauthorized('令牌无效或已过期'));
  }
}

/**
 * 可选鉴权中间件
 * ------------------------------------------------------------
 * 用在「登录与否都能访问，但行为不同」的接口上。
 *
 * 典型场景：文章详情 /api/posts/:slug
 *   - 带 token  → 管理员，能看到未发布的草稿
 *   - 不带 token → 普通访客，只看已发布的
 *
 * 和 requireAuth 的区别：token 缺失或无效时**不报错**，
 * 只是 req.user 保持 undefined，直接放行让 controller 自己判断。
 * 这样同一个接口就能同时服务前台和后台。
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);

  if (token) {
    try {
      const payload = verifyToken(token);
      if (payload.type === 'access') {
        req.user = payload;
      }
    } catch {
      // 静默忽略：token 过期/伪造都当匿名访客处理，不阻断请求
    }
  }

  next();
}

/**
 * 角色校验中间件：requireRole('ADMIN')
 * 必须在 requireAuth 之后使用，因为依赖 req.user
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized('未登录'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden('权限不足'));
      return;
    }
    next();
  };
}
