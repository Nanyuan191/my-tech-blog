import type { Request, Response } from 'express';
import { z } from 'zod';
import * as userService from '../services/user.service';
import { signAccessToken, signRefreshToken, verifyToken, extractBearerToken } from '../utils/auth';
import { AppError } from '../middlewares/errorHandler';

/**
 * 登录参数校验
 *
 * 为什么用 Zod 而不是 if-else？答辩可讲的两点：
 *   1. 声明式：校验规则和业务代码分离，读起来像一份"接口契约文档"
 *   2. 类型推导：z.infer 能自动把 schema 转成 TS 类型，
 *      不用重复手写一遍 interface（避免两者不一致）
 */
const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空').max(191),
  password: z.string().min(6, '密码至少 6 位').max(128),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6, '新密码至少 6 位').max(128),
});

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);

  // safeParse 不抛异常，返回 {success, data|error}，用它来构造友好的错误信息
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw AppError.badRequest(first?.message ?? '参数不合法');
  }

  const { username, password } = parsed.data;

  // service 层负责校验，校验失败会抛 401
  const user = await userService.validateCredentials(username, password);

  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // refresh token 放 httpOnly Cookie 而不是返回在 JSON 里：
  //   - httpOnly 的 Cookie JS 读不到，XSS 无法窃取
  //   - sameSite=lax 阻止跨站请求携带，缓解 CSRF
  // access token 则放 JSON 里由前端手动带上（存内存中，不放 localStorage）
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });

  res.json({
    success: true,
    data: {
      accessToken,
      // 顺便返回过期秒数，前端可以据此提前刷新，避免请求刚好卡在过期点
      expiresIn: 2 * 60 * 60,
      user: userService.toSafeUser(user),
    },
  });
}

/**
 * 用 refresh token 换新的 access token
 *
 * 这是「无感刷新」的关键：access token 过期时前端自动调这个接口，
 * 用户完全察觉不到，不会突然被踢到登录页。
 */
export async function refresh(req: Request, res: Response) {
  // 优先从 Cookie 取，兼容从 body 传（比如移动端）
  const token = req.cookies?.refreshToken ?? req.body?.refreshToken;

  if (!token) throw AppError.unauthorized('缺少刷新令牌');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw AppError.unauthorized('刷新令牌无效或已过期');
  }

  if (payload.type !== 'refresh') {
    throw AppError.unauthorized('令牌类型不正确');
  }

  // 再查一次数据库，确认用户还存在且没被禁用
  // —— 否则用户被删了但 token 还没过期，依然能刷新出新的 access token
  const user = await userService.findUserById(payload.sub);

  const newPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
  };

  res.json({
    success: true,
    data: {
      accessToken: signAccessToken(newPayload),
      expiresIn: 2 * 60 * 60,
      user: userService.toSafeUser(user),
    },
  });
}

export async function logout(_req: Request, res: Response) {
  // 清掉 refresh Cookie。access token 是纯 JWT 无状态，只能等它自然过期
  // （要立即失效需要 Redis 黑名单，属于 S8 扩展）
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ success: true, message: '已退出登录' });
}

/** 获取当前登录用户信息 —— 前端启动时用它判断登录态是否还有效 */
export async function me(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized('未登录');
  const user = await userService.findUserById(req.user.sub);
  res.json({ success: true, data: userService.toSafeUser(user) });
}

export async function changePassword(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized('未登录');

  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest(parsed.error.issues[0]?.message ?? '参数不合法');
  }

  await userService.changePassword(
    req.user.sub,
    parsed.data.oldPassword,
    parsed.data.newPassword
  );

  res.json({ success: true, message: '密码修改成功，请重新登录' });
}
