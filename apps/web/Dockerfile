# ============================================================
# 前端镜像：构建静态产物 + Nginx 托管
# ============================================================
# 前端不需要 Node 运行时 —— Vue 打包后就是一堆 html/js/css 静态文件，
# 用 Nginx 托管又快又稳。所以最终镜像里根本没有 node，只有 nginx。
# 这是前端容器化最常见的形态，也是"用对工具"的体现。

# ---------- 阶段1：构建 ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY apps/web ./apps/web

# 生产构建，产物在 apps/web/dist
RUN cd apps/web && npm run build

# ---------- 阶段2：Nginx 托管 ----------
FROM nginx:1.27-alpine AS runner

# 移除默认站点配置，换成我们自己的
RUN rm -f /etc/nginx/conf.d/default.conf
COPY apps/web/nginx.conf /etc/nginx/conf.d/blog.conf

# 把构建产物丢进 Nginx 的网站根目录
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
