import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { hashPassword, comparePassword } from '../utils/auth';

/**
 * 用户服务层
 * ------------------------------------------------------------
 * 分层原则：controller 只做「解析请求 / 组装响应」，
 * 真正的业务规则（谁能做什么、数据怎么变）全部在 service 里。
 *
 * 这样拆的好处：
 *   1. 业务逻辑可以脱离 HTTP 单独测试
 *   2. 同一段逻辑能被多处复用（比如登录接口和后台用户管理都要校验密码）
 *   3. 改业务不用动路由，改路由不用动业务
 */

/** 对外返回的用户信息 —— 永远不包含 passwordHash */
export interface SafeUser {
  id: number;
  email: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
  role: string;
}

/** 剥掉敏感字段。这是最后一道防线：即使 service 里误传了完整对象出去，
 *  经过这里也不会把密码哈希泄漏给前端。 */
export function toSafeUser(user: {
  id: number;
  email: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
  role: string;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    role: user.role,
  };
}

/**
 * 校验登录凭据
 *
 * 安全细节（答辩可讲）：用户名不存在和密码错误返回**同一个错误信息**。
 * 如果分别返回"用户不存在"和"密码错误"，攻击者就能通过错误信息差异
 * 枚举出系统里有哪些用户名 —— 这叫「用户名枚举漏洞」。
 */
export async function validateCredentials(username: string, password: string) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email: username }],
    },
  });

  const INVALID = AppError.unauthorized('用户名或密码错误');

  if (!user) {
    // 即使这里没找到用户，也走一次假的 bcrypt 比较，
    // 让响应耗时和"用户存在但密码错"保持一致，
    // 防止攻击者通过响应时间差异来判断用户是否存在（时序攻击）。
    await comparePassword(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    throw INVALID;
  }

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) throw INVALID;

  return user;
}

export async function findUserById(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.notFound('用户不存在');
  return user;
}

/**
 * 修改密码
 */
export async function changePassword(userId: number, oldPwd: string, newPwd: string) {
  const user = await findUserById(userId);

  const ok = await comparePassword(oldPwd, user.passwordHash);
  if (!ok) throw AppError.badRequest('原密码不正确');

  const passwordHash = await hashPassword(newPwd);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return true;
}
