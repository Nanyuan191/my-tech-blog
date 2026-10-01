import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';

/**
 * 健康检查路由
 *
 * 为什么单独做一个 /api/health？
 * 1. Docker Compose 的 healthcheck 需要它：db 起来后才能拉起 api
 * 2. 上线后自查：浏览器直接打开 http://公网IP:8080/api/health 就能确认后端活着
 * 3. 答辩演示：一句话说明"后端不是摆设，它有可观测的存活探针"
 *
 * 设计要点：这里主动 ping 一次数据库。
 * 如果只返回 {ok:true} 那是骗人的 —— 进程活着不代表数据库连得上。
 * 用 SELECT 1 实测一次，才能真实反映"整条链路（api -> mysql）是否通"。
 */
export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const startedAt = Date.now();

  let dbOk = false;
  let dbError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const payload = {
    ok: dbOk,
    service: 'blog-api',
    env: env.NODE_ENV,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      ok: dbOk,
      latencyMs: Date.now() - startedAt,
      // 生产环境不回显具体错误，避免把连接串/主机名泄漏到公网
      error: env.isProd ? (dbOk ? null : 'unavailable') : dbError,
    },
  };

  res.status(dbOk ? 200 : 503).json(payload);
});
