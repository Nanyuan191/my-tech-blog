/**
 * Prisma Client 单例
 * ------------------------------------------------------------
 * 为什么要做单例（singleton）？
 *   Prisma Client 内部维护一个数据库连接池。如果在每个模块里都 new 一个新实例，
 *   会出现连接数爆炸——开发时热重载（tsx watch）会反复执行模块，几轮下来
 *   连接池就被打满，MySQL 报 "Too many connections"。
 *
 *   所以标准做法是：把实例挂在 globalThis 上，热重载时复用同一个。
 *   这段 if/else 是 Prisma 官方推荐的开发环境写法。
 */
import { PrismaClient } from '@prisma/client';

import { env } from '../config/env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // 开发环境打印 SQL；生产环境只打错误，避免日志爆炸
    log: env.isProd ? ['error'] : ['query', 'warn', 'error'],
  });

if (!env.isProd) {
  globalForPrisma.prisma = prisma;
}
