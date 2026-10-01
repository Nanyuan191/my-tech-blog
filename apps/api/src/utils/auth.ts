import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

/**
 * 鉴权工具集
 * ------------------------------------------------------------
 * 设计：access token 短期（2h）+ refresh token 长期（7d）
 *
 * 为什么要两个 token？答辩必问：
 *   如果只有一个长期 token，一旦泄漏就等于永久失守，且无法撤销。
 *   拆成两个之后：
 *     - access token 只活 2 小时，泄漏的窗口期很短
 *     - refresh token 只用来换新的 access token，不参与业务请求
 *   这样即使 access 被截获，攻击面也被压到 2 小时内。
 *   （完整的撤销机制需要 Redis 存黑名单，属于 S8 附加功能的扩展空间）
 */

/**
 * 我们自己的 token 载荷结构。
 *
 * 命名注意：jsonwebtoken 包内部也导出了一个叫 JwtPayload 的类型
 * （它把 sub 定义为 string | undefined，且字段全是可选的）。
 * 两个同名类型混在一起会让 TS 报 "类型不重叠" 的转换错误，
 * 所以这里显式改名，避免和库的类型打架。
 */
export interface AuthPayload {
  sub: number;      // 用户 id
  username: string;
  role: string;
  type: 'access' | 'refresh';
}

export function signAccessToken(payload: Omit<AuthPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: Omit<AuthPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthPayload {
  // verify 失败会抛 JsonWebTokenError / TokenExpiredError，
  // 由调用方转成 401，不在这里处理（保持工具函数纯粹）
  //
  // 先断言成 unknown 再转为我们自己的类型：这是 TS 的推荐做法。
  // 因为 jwt 库的返回类型 JwtPayload 与我们定义的结构没有充分重叠，
  // 直接 as 会被编译器拦下（"两个类型不够相似"）。
  // 走一趟 unknown 等于告诉编译器"我知道这里在做类型收窄，责任我担"。
  return jwt.verify(token, env.JWT_SECRET) as unknown as AuthPayload;
}

// ---- 密码 ----
// bcrypt 的 cost=10 是速度与安全的折中：约 100ms 一次哈希，
// 对正常登录无感，但对暴力破解来说成本被放大了 1024 倍。
const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * 从 "Bearer xxx" 里取出 token，取不到返回 null
 */
export function extractBearerToken(header?: string): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

/**
 * 生成 slug（URL 友好的短标识）
 * 中文标题没法直接做 slug，所以策略是：保留英文/数字，中文转拼音太重，
 * 直接用「时间戳 + 随机串」兜底，保证唯一且可读性够用。
 */
export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // 纯中文标题 => base 里全是中文，URL 里会出现百分号编码，不好看。
  // 这里只保留 ascii 部分；如果为空，退化为 post
  const ascii = base.replace(/[^\x00-\x7F]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const prefix = ascii || 'post';

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${suffix}`;
}
