# 个人技术博客系统

> 科创部考核 · 题目1：全栈基础与工程交付

一个前后端分离的个人技术博客系统，支持 Markdown 文章发布、分类标签管理、后台鉴权管理，全流程 Docker 化部署 + GitHub Actions 自动化交付。

---

## 一、快速开始

### 本地开发（不用 Docker）

```bash
# 1. 启动数据库（只起 MySQL 一个容器即可）
docker compose up -d db

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp apps/api/.env.example apps/api/.env

# 4. 建表并生成 Prisma Client
npm run prisma:migrate --workspace=apps/api

# 5. 写入初始管理员账号
npm run seed --workspace=apps/api

# 6. 前后端一起跑
npm run dev
#   前端 → http://localhost:5173
#   后端 → http://localhost:3000/api/health
```

### 一键启动（Docker Compose）

```bash
docker compose up -d --build
docker compose ps
# 浏览器打开 http://localhost:8080
```

---

## 二、技术栈与选型理由

> 这一节是考核「必须项2：技术栈说明」的正面回答，每条都写清楚**为什么选它**而不是"它很流行"。

### 前端

| 技术 | 版本 | 选型理由 |
|---|---|---|
| **Vue 3** | 3.5.x | 组合式 API 让逻辑按功能聚合而非按选项类型分散，`<script setup>` 写起来接近原生 JS。相比 React 的 JSX，模板语法对新手更直观，调试时能直接在浏览器 DevTools 里看到组件树和状态。 |
| **Vite** | 6.x | 开发时用 ESM 原生加载、不做打包，冷启动从 Webpack 的十几秒降到 1 秒内；生产构建用 Rollup，产物更小。 |
| **TypeScript** | 5.7 | 前后端共用一套类型定义，接口字段改动能被编译器当场发现，而不是等到线上报 `undefined`。这是本项目贯穿始终的工程约束。 |
| **Element Plus** | 2.9.x | 后台管理需要表格、表单、分页、对话框、消息提示等大量企业级组件。从零手写这些至少要一周，用成熟组件库把时间留给核心业务逻辑。 |
| **Pinia** | 2.3.x | Vue 官方推荐的状态管理。比 Vuex 少了 mutation 层，直接改 state 即可，配合 TS 有完整类型推导。 |
| **markdown-it + highlight.js + DOMPurify** | — | 文章渲染三件套，缺一不可：<br>`markdown-it` 把 Markdown 转 HTML；`highlight.js` 做代码块语法高亮；`DOMPurify` 对渲染结果做 XSS 消毒 —— **这一步最关键**，因为 Markdown 允许内嵌原始 HTML，如果不消毒，一条 `<script>` 就能盗走访客的 token。 |
| **Tailwind CSS** | 4.x | 原子化 CSS，避免为了改一个间距去翻几个文件找类名。与 Element Plus 共存，负责自定义布局部分。 |

### 后端

| 技术 | 版本 | 选型理由 |
|---|---|---|
| **Node.js + Express** | 20 / 4.21 | 与前端同语言，一套 TS 类型贯穿全栈，减少上下文切换。Express 中间件模型简单直白 —— 请求像水流过一串管道，每一环都能读改写，这种"看得见流程"的特性对讲清架构很有利。 |
| **TypeScript** | 5.7 | 同上。后端强类型能挡住大量运行时错误，比如 `req.body.title` 拼错成 `tittle` 会直接编译不过。 |
| **Prisma ORM** | 6.x | 相比手写 SQL 和 TypeORM，Prisma 的 schema 文件是**单一事实来源**，迁移自动生成且可提交到 Git，有完整版本记录。生成的 Client 带类型提示，`prisma.article.findMany({...})` 的每个字段都有补全，几乎不可能写错表名。 |
| **MySQL** | 8.0 | 关系型数据库适合博客这种结构化数据（文章-分类-标签天然是关系）。选 8.0 是因为它原生支持 `utf8mb4` 字符集，能正确存储 emoji 和生僻字；而 5.7 的 JSON 支持和窗口函数都不够用。 |
| **JWT + bcrypt** | — | 详见「三、核心实现」的鉴权章节。 |
| **Zod** | 3.x | 请求参数校验。所有 `req.body` 进来先过一遍 Zod schema，类型和运行时校验一次搞定，不信任任何客户端输入。 |
| **Helmet / CORS / rate-limit** | — | 安全三件套：Helmet 设置安全响应头，CORS 控制跨域来源，rate-limit 防暴力破解登录接口。 |

### 部署与运维

| 技术 | 选型理由 |
|---|---|
| **Docker + Docker Compose** | 把「装 Node、装 MySQL、配环境变量、建表」这一串手工步骤固化成配置文件。评委拿到项目后一条命令就能跑起来，不需要复现我的环境。这是**加分项1**的直接交付物。 |
| **Nginx** | 前端静态托管的工业标准。同时承担反向代理，让前后端在浏览器看来是同源的，从根本上消除跨域问题。 |
| **GitHub Actions + GHCR** | **加分项2**的交付物。镜像推到 GitHub Container Registry，用仓库自带的 `GITHUB_TOKEN` 鉴权，无需额外配置密码，密钥管理最简。 |
| **腾讯云轻量应用服务器** | 见下方「部署方案」章节 —— 这是经过实际验证的国内可达方案。 |

---

## 三、部署方案

### 主链接：腾讯云服务器 + IP 直连

**方案：** 腾讯云轻量应用服务器（2核2G，约 60 元/月），`docker compose up -d` 拉起全栈，通过 `http://<公网IP>:8080` 访问。

**为什么用 IP 而不是域名？** 这是踩过坑之后的决定：

> 腾讯云**中国大陆节点**上，80/443 端口必须完成 **ICP 备案**才能对外提供服务（备案周期 3–20 个工作日）。如果在备案完成前就绑定域名，访问会被运营商拦截。
>
> 而**非标准端口（如 8080）不受此限制**，服务器开通当天就能对外提供服务。

所以策略是分两步走：

1. **交付主链接用 `http://公网IP:8080`** —— 零备案依赖，当天可用，保证「必须项1：线上可访问链接」稳稳拿到分
2. **同步启动 ICP 备案** —— 备案通过后再切到域名 + 443 HTTPS 作为长期方案

**为什么不用 Vercel？** 评估过 Next.js + Vercel 方案，有两个否决性理由：

1. Vercel 是 Serverless 平台，**不运行 Dockerfile**。如果主站部署在 Vercel，`docker-compose.yml` 就只是个本地玩具，"一键拉起前后端及数据库"的加分项逻辑讲不通。
2. `*.vercel.app` 域名在国内 DNS 解析不稳定，存在超时和解析异常，直接威胁「必须项1」。

### 服务器侧的关键设计

- **只暴露一个端口：** Compose 里只有 `web` 服务映射了 `8080:80`，`api` 和 `db` 只在内部 bridge 网络中可见。数据库绝不直接对公网开放 —— 这是最小暴露面原则。
- **健康检查驱动启动顺序：** `db` 有 `mysqladmin ping` 探针，`api` 有 HTTP 探针，`depends_on.condition: service_healthy` 保证「数据库真的就绪了才启动后端」，避免容器起来但连不上库的经典问题。
- **数据持久化：** MySQL 数据存在命名卷 `db_data` 中，容器重建不会丢数据。

---

## 四、项目结构

```
blog-system/
├── apps/
│   ├── api/                        # 后端服务
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # 数据模型定义（单一事实来源）
│   │   │   └── migrations/         # 迁移 SQL，提交到 Git
│   │   ├── src/
│   │   │   ├── config/env.ts       # 环境变量集中管理
│   │   │   ├── lib/prisma.ts       # Prisma Client 单例
│   │   │   ├── middlewares/
│   │   │   │   ├── auth.ts         # JWT 鉴权 + 角色校验
│   │   │   │   └── errorHandler.ts # 全局错误处理
│   │   │   ├── routes/             # 路由层
│   │   │   ├── controllers/        # 控制器：处理请求响应
│   │   │   ├── services/           # 服务层：业务逻辑
│   │   │   ├── utils/              # 日志、鉴权工具
│   │   │   ├── app.ts              # Express 装配
│   │   │   └── server.ts           # 进程入口
│   │   ├── Dockerfile
│   │   └── .env.example
│   └── web/                        # 前端应用
│       ├── src/
│       │   ├── views/              # 页面
│       │   ├── components/         # 组件
│       │   ├── api/                # 接口封装
│       │   ├── router/             # 路由
│       │   └── stores/             # Pinia 状态
│       ├── Dockerfile
│       └── nginx.conf
├── .github/workflows/ci-cd.yml     # CI/CD 流水线
├── docker-compose.yml              # 本地/通用编排
├── docker-compose.prod.yml         # 生产覆盖配置
└── package.json                    # npm workspaces 根
```

**为什么用 monorepo？** 前后端共享类型定义（比如 `Article` 的字段结构），放在一个仓库里可以直接 `import type`，不用维护两份手抄的类型。npm workspaces 让依赖提升到根 `node_modules`，一次 `npm install` 装完两端。

---

## 五、文档索引

| 文档 | 内容 |
|---|---|
| `docs/开发进度报告.md` | **当前进度到哪了**：阶段总览 + 验证证据 + 关闭程序的注意事项 + 恢复步骤 |
| `docs/前端操作手册-手把手版.md` | **新手从零开始做前端**：怎么打开 VS Code、敲什么命令、看到什么算成功、报错怎么办 |
| `docs/前端开发交接指南.md` | 前端接口清单 + 数据类型 + 动手顺序 + 常见坑 |
| `docs/技术选型说明.md` | 技术栈深度说明（必须项2 正式版） |
| `docs/核心代码详解.md` | 关键代码逐段讲解（必须项3 正式版） |
| `docs/部署手册.md` | 服务器从零到上线的完整步骤 |
| `docs/答辩要点.md` | 评分点对照 + 演示脚本 + 预设问题 |

---

## 六、开发进度

- [x] **S0** 环境搭建（Git / Node 24 / VS Code + 8 插件 / Docker Desktop / WSL2 / 镜像加速器）
- [x] **S1** Monorepo 骨架 + Git 仓库初始化
- [x] **S2** 数据模型（Prisma schema）+ 后端 API —— **11 项接口验证通过**
- [x] **S3** 前端展示站（首页列表 / 文章详情 / Markdown 渲染 + 语法高亮）—— **已封版**
- [x] **S4** 后台管理系统（登录 / 路由守卫 / 发文增删改查）—— **已封版**
- [x] **S5** Docker 化（Dockerfile × 2 + compose × 3 + nginx）*—— 文件就绪，全栈验证待执行*
- [x] **S6** CI/CD 流水线（GitHub Actions + GHCR）*—— 文件就绪，待推送到 GitHub 后联调*
- [ ] **S7** 腾讯云上线
- [ ] **S8** 附加功能（评论系统）
- [~] **S9** 交付文档 —— *6 份已成稿，界面截图/录屏待装修后补拍*

> 详细进度与验证证据见 `docs/开发进度报告.md`。

### 前端验证结果（2026-10-01）

| 测试项 | 结果 |
|---|---|
| TypeScript 类型检查 `vue-tsc --noEmit` | ✅ 0 error |
| 生产构建 `vite build` | ✅ 0 error，1822 模块，14.67s |
| 页面级代码分割 | ✅ 4 个页面各自独立 chunk |
| Markdown 分块体积 | ✅ 155.80 kB（按需注册 highlight.js，优化前 1113 kB） |
| 人工闭环验证 | ✅ 写文章 → 发布 → 首页可见 → 编辑 → 删除 |

### 后端验证结果（2026-09-30）

| 测试项 | 结果 |
|---|---|
| TypeScript 类型检查 | ✅ 0 error |
| Prisma Client 生成 | ✅ v6.19.3，2.02s |
| 数据库迁移建表 | ✅ 6 张表 |
| 种子数据写入 | ✅ 1 管理员 / 3 分类 / 8 标签 / 3 文章 |
| 健康检查 `/api/health` | ✅ `database.ok: true`，延迟 14ms |
| 文章列表 `/api/posts` | ✅ 返回 3 篇 |
| 分类/标签列表 | ✅ 文章数统计正确 |
| **鉴权拦截**（无 token 访问后台） | ✅ HTTP 401 |
| **登录流程** | ✅ 签发 JWT，role=ADMIN |
| **带 token 访问后台** | ✅ HTTP 200 |
| **错误密码** | ✅ HTTP 401 |
| **匿名访问草稿文章** | ✅ HTTP 404（防越权） |
| **带 token 访问草稿** | ✅ HTTP 200（optionalAuth 生效） |

