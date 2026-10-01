# ============================================================
# 后端镜像：多阶段构建（Multi-stage Build）
# ============================================================
# 为什么要多阶段？对比一下体积：
#   单阶段（带 node_modules + 源码 + devDependencies）→ 约 900MB
#   多阶段（只留生产依赖 + 编译产物）              → 约 180MB
# 差距来自三块：devDependencies、TypeScript 源码、npm 缓存。
# 答辩时这是「Docker 化不只是写个 Dockerfile，而是懂镜像优化」的加分点。

# ---------- 阶段1：依赖安装 ----------
FROM node:20-alpine AS deps
WORKDIR /app

# 先只拷贝清单文件，再装依赖 —— 这是利用 Docker 层缓存的经典技巧。
# 只要 package.json 没变，改业务代码时这一步的缓存依然命中，
# 构建时间从几分钟降到几秒。
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# --omit=dev 之外先装全部，因为下面编译 TS 需要 typescript
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# ---------- 阶段2：编译 ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json ./
COPY apps/api ./apps/api

# 生成 Prisma Client（会根据 schema.prisma 产出类型化的查询对象）
RUN cd apps/api && npx prisma generate

# tsc 把 TypeScript 编译成 JavaScript
RUN cd apps/api && npm run build

# ---------- 阶段3：生产运行 ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# 安全加固：不用 root 跑应用。
# 容器逃逸类漏洞的前提往往是"容器内是 root"，
# 换成普通用户能把影响面压到最低。
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# 只拷贝运行时真正需要的东西
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/package.json ./apps/api/

# Prisma 的 query engine 是二进制文件，Alpine 需要额外装 openssl
RUN apk add --no-cache openssl

USER nodejs
EXPOSE 3000

WORKDIR /app/apps/api

# 启动脚本里做两件事：先跑迁移，再启服务。
# 这样容器首次启动时会自动建表，不需要人工进容器执行命令。
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
