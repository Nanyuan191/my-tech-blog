# ============================================================
# 后端镜像：多阶段构建（Multi-stage Build）
# ============================================================
# 为什么要多阶段？核心是「构建期需要的东西 ≠ 运行期需要的东西」：
#   - TypeScript 源码（运行跑的是编译后的 dist）
#   - npm 缓存
#   - 只给构建用的工具链
# 单阶段把源码 + 全套依赖 + 缓存一起塞进镜像，多阶段只留运行产物。
#
# 实测体积（2026-10-01，本机）：后端镜像 788MB，其中 node_modules 441MB。
# 已知取舍：本项目是 npm workspaces，依赖会被「提升」到根 node_modules，
#   所以后端镜像里也躺着前端用的 element-plus / vite（约 90MB）。
#   这是 monorepo 共享一份 lockfile 换来的便利，属于可接受的代价；
#   要进一步瘦身可拆 lockfile 或做 workspace 级裁剪。
# 对比：前端镜像是纯 nginx + 静态产物，只有 76MB（多阶段效果最直观的体现）。

# ---------- 阶段1：依赖安装 ----------
FROM node:20-alpine AS deps
WORKDIR /app

# ---- 国内构建适配 ----
# 1) npm 官方源在国内经常超时 → 默认换成 npmmirror
#    想换回官方源：--build-arg NPM_REGISTRY=https://registry.npmjs.org
# 2) Prisma 的引擎二进制默认从 binaries.prisma.sh 下载。
#    该域名走 Cloudflare CDN，国内大多数网络可直连，所以留空走默认值。
#    若构建机确实访问不了，可切到 npmmirror 的同构镜像（路径结构一致）：
#    --build-arg PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_ENGINES_MIRROR=
RUN npm config set registry $NPM_REGISTRY
ENV PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR

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

# prisma generate 需要引擎二进制（若缺失会联网取），保持一致的可选镜像设置
ARG PRISMA_ENGINES_MIRROR=
ENV PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR

COPY --from=deps /app/node_modules ./node_modules
# 注意：不要 COPY apps/api/node_modules ——
# 本项目是 npm workspaces（monorepo），npm ci 会把所有依赖"提升"到根
# /app/node_modules，子包目录下根本没有 node_modules，COPY 会直接报
# "/app/apps/api/node_modules: not found" 而构建失败。
# Node 的模块解析本来就会逐级向上查找，根目录的 node_modules 足够用。
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
# ⚠️ 关键：node_modules 必须从 builder 阶段拷，不能从 deps 阶段拷 ——
#    deps 阶段只是装好了依赖，builder 阶段才执行了 `prisma generate`，
#    生成的 Prisma Client 就写在 node_modules/.prisma 里。
#    从 deps 拷 → 运行时会报 "@prisma/client did not initialize yet"。
COPY --from=builder /app/node_modules ./node_modules
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
