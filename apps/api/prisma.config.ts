import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 配置文件
 * ------------------------------------------------------------
 * Prisma 7 会把配置从 package.json 的 "prisma" 字段迁到这里。
 * 提前用上，避免以后升级时手忙脚乱（现在生成时会 warn 提示）。
 *
 * ⚠️ 这里踩过一个坑，记下来：
 * 一旦存在 prisma.config.ts，Prisma CLI 就**不再自动加载 .env 文件**
 * （日志里会打印 "Prisma config detected, skipping environment variable loading"）。
 * 结果就是 schema.prisma 里的 env("DATABASE_URL") 取不到值，
 * 报 P1012: Environment variable not found: DATABASE_URL。
 *
 * 解决：第一行的 `import 'dotenv/config'` 手动把 .env 读进 process.env。
 * 必须在 defineConfig 之前执行，所以放在文件最顶部。
 *
 * 另外这里刻意不写 datasource.url —— 数据库地址由 schema.prisma 的
 * datasource 块提供，避免两处定义不一致。
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
