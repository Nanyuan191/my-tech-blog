/**
 * 统一日志工具
 * ------------------------------------------------------------
 * 为什么不用 console.log？
 *   1. 无法分级 —— 生产环境想只看 error，console.log 做不到
 *   2. 没有时间戳 —— 排查问题时不知道什么时候发生的
 *   3. 无结构 —— 日志收集系统（如 ELK）需要结构化输出
 *
 * 这里做一个极简实现，不引入 winston/pino 这类重型依赖，
 * 原因是：教学项目里代码越透明越好讲。真上生产再换。
 */
import { env } from '../config/env';

type Level = 'info' | 'warn' | 'error' | 'debug';

function timestamp(): string {
  const d = new Date();
  const pad = (n: number, len = 2): string => String(n).padStart(len, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.` +
    `${pad(d.getMilliseconds(), 3)}`
  );
}

// 简单着色，让终端日志一眼能分辨级别
const colors: Record<Level, string> = {
  info: '\x1b[36m', // 青
  warn: '\x1b[33m', // 黄
  error: '\x1b[31m', // 红
  debug: '\x1b[90m', // 灰
};
const RESET = '\x1b[0m';

function output(level: Level, args: unknown[]): void {
  // 生产环境不输出 debug
  if (level === 'debug' && env.isProd) return;

  const tag = env.isProd ? `[${level.toUpperCase()}]` : `${colors[level]}[${level.toUpperCase()}]${RESET}`;
  // 生产环境输出纯 JSON，方便日志系统解析；开发环境输出可读的彩色行
  if (env.isProd) {
    console.log(JSON.stringify({ time: timestamp(), level, msg: args.map(String).join(' ') }));
  } else {
    console.log(`${timestamp()} ${tag}`, ...args);
  }
}

export const logger = {
  info: (...args: unknown[]): void => output('info', args),
  warn: (...args: unknown[]): void => output('warn', args),
  error: (...args: unknown[]): void => output('error', args),
  debug: (...args: unknown[]): void => output('debug', args),
};
