/**
 * 环境变量集中管理
 * ------------------------------------------------------------
 * 为什么单独建这个文件？
 *   把 process.env 的读取收敛到一处，好处有三：
 *   1. 类型安全 —— 其他地方 import 时能获得类型提示
 *   2. 快速失败 —— 必填项缺失时立刻报错，而不是等运行时才崩
 *   3. 可测试 —— 测试环境可以整体替换这一层
 *
 * 密钥来源：本地开发从 .env 读；生产从 docker-compose 的环境变量注入
 * 注意：.env 已加入 .gitignore，绝不进仓库
 */
import dotenv from 'dotenv';

dotenv.config();

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`[env] 缺少必需的环境变量: ${key}。请检查 .env 文件。`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  /** 运行环境：development / production / test */
  NODE_ENV: optional('NODE_ENV', 'development'),

  /** 后端监听端口 */
  PORT: Number(optional('PORT', '3000')),

  /** 数据库连接串，Prisma 也会读这个变量 */
  DATABASE_URL: required('DATABASE_URL', 'mysql://blog:blog123@localhost:3306/blog'),

  /** JWT 签名密钥 —— 生产环境必须换成随机长字符串 */
  JWT_SECRET: required('JWT_SECRET', 'dev-only-secret-change-me-in-production'),

  /** access token 有效期（短，降低泄露风险） */
  JWT_ACCESS_EXPIRES: optional('JWT_ACCESS_EXPIRES', '2h'),

  /** refresh token 有效期（长，用于换新的 access token） */
  JWT_REFRESH_EXPIRES: optional('JWT_REFRESH_EXPIRES', '7d'),

  /** 允许跨域的来源。生产是同域部署，所以留空表示不启用 CORS */
  CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:5173'),

  /** 日志级别（morgan 用） */
  LOG_FORMAT: optional('LOG_FORMAT', 'dev'),

  /** 是否生产环境 */
  get isProd(): boolean {
    return this.NODE_ENV === 'production';
  },
} as const;

export type Env = typeof env;
