/**
 * 服务入口（Server Bootstrap）
 * ------------------------------------------------------------
 * 这个文件的唯一职责：创建应用 → 监听端口 → 处理优雅退出。
 *
 * 为什么要有"优雅退出"（graceful shutdown）？
 *   直接 Ctrl+C 或 docker stop 会立刻杀掉进程，正在处理的请求被腰斩，
 *   数据库连接也不会正常释放。加上信号监听后，进程会：
 *     1. 停止接受新连接
 *     2. 等现有请求处理完
 *     3. 关闭数据库连接池
 *     4. 退出
 *   这是生产环境的基本要求，也是答辩时能说的一处细节。
 *
 * 健康检查为什么单独一个路由？
 *   容器编排（docker compose / k8s）需要一个探针来判断服务是否"活着"。
 *   没有它，编排工具只能靠端口是否可连，无法确认应用内部是否正常。
 */
import http from 'node:http';

import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { logger } from './utils/logger';

const app = createApp();
const server = http.createServer(app);

async function bootstrap(): Promise<void> {
  try {
    // 启动时主动探测一次数据库连接。
    // 好处：配置错了立刻暴露，而不是等第一个请求进来才报错。
    await prisma.$connect();
    logger.info('数据库连接成功');

    server.listen(env.PORT, () => {
      logger.info(`服务已启动 → http://localhost:${env.PORT}`);
      logger.info(`健康检查   → http://localhost:${env.PORT}/api/health`);
      logger.info(`运行环境   → ${env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('启动失败：', error);
    process.exit(1);
  }
}

/**
 * 优雅退出的实现
 * 收到 SIGTERM（容器停止信号）或 SIGINT（Ctrl+C）时触发
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`收到 ${signal}，开始优雅退出...`);

  // 停止接受新连接，等待现有请求完成（最多等 10 秒）
  server.close(async () => {
    logger.info('HTTP 服务已关闭');
    await prisma.$disconnect();
    logger.info('数据库连接已释放');
    process.exit(0);
  });

  // 兜底：10 秒内没退干净就强制退出，避免进程卡死
  setTimeout(() => {
    logger.error('优雅退出超时，强制结束进程');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// 捕获未处理的异常和 Rejection，避免进程静默崩溃
process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  process.exit(1);
});

void bootstrap();
