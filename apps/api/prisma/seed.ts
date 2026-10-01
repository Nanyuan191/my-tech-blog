/**
 * 种子数据脚本
 * ------------------------------------------------------------
 * 作用：把「系统刚建好、数据库全空」这个状态填成一个可演示的样子。
 *
 * 为什么需要它？答辩时打开后台，如果一篇文章都没有，
 * 评审根本看不出功能是否正常。一条命令灌入初始数据，
 * 现场演示立刻有内容可看。
 *
 * 幂等设计：用 upsert 而不是 create。
 * 重复执行不会报错、不会产生重复数据 —— 这对新手很友好，
 * 不确定自己跑过没有就再跑一次，不会有副作用。
 *
 * 运行：npm run seed --workspace=apps/api
 */
import { PrismaClient, ArticleStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始写入种子数据...\n');

  // ---------- 1. 管理员账号 ----------
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const plainPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123456';

  // 注意：seed 也会用 bcrypt 加盐哈希，绝不存明文。
  // 每个字符串的盐不同，所以同一密码每次生成的哈希都不一样，
  // 这是 bcrypt 的正常行为（哈希里已经包含了盐）。
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const admin = await prisma.user.upsert({
    where: { username },
    update: {}, // 已存在就什么都不改（避免覆盖你改过的密码）
    create: {
      email,
      username,
      passwordHash,
      nickname: '站长',
      role: 'ADMIN',
    },
  });
  console.log(`✓ 管理员账号：${admin.username}（密码：${plainPassword}）`);

  // ---------- 2. 分类 ----------
  const categoryData = [
    { name: '技术笔记', slug: 'tech', description: '开发过程中的技术总结与踩坑记录', sortOrder: 1 },
    { name: '工程实践', slug: 'engineering', description: '部署、运维、CI/CD 等工程化话题', sortOrder: 2 },
    { name: '随笔', slug: 'essay', description: '一些零散的想法', sortOrder: 3 },
  ];

  const categories: Record<string, number> = {};
  for (const c of categoryData) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, sortOrder: c.sortOrder },
      create: c,
    });
    categories[c.slug] = row.id;
  }
  console.log(`✓ 分类 ${categoryData.length} 个`);

  // ---------- 3. 标签 ----------
  const tagNames = ['Vue', 'TypeScript', 'Docker', 'Node.js', 'Prisma', 'MySQL', 'Nginx', 'CI/CD'];
  const tags: Record<string, number> = {};
  for (const name of tagNames) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const row = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    tags[name] = row.id;
  }
  console.log(`✓ 标签 ${tagNames.length} 个`);

  // ---------- 4. 示例文章 ----------
  const articles = [
    {
      title: '为什么我选择 Vue 3 + Express 而不是 Next.js',
      slug: 'why-vue-express-over-nextjs',
      categorySlug: 'engineering',
      tagNames: ['Vue', 'Node.js'],
      summary: '在搭建这个博客系统时，我在两套技术栈之间做过取舍。这篇文章记录我的判断依据。',
      content: `## 起因

搭建个人博客时最容易被推荐的是 Next.js + Vercel 这个组合。它确实优雅：一个仓库、一次部署、全栈通吃。

但在明确了"必须包含 Docker 化部署"这个考核要求之后，我发现这条路走不通。

## 关键约束：Vercel 不运行 Dockerfile

Vercel 是 Serverless 平台。它的工作方式是：你提交代码，它把你的页面函数化，分发到边缘节点。整个流程里**没有容器**这个环节 —— 它不会去读你的 \`Dockerfile\`。

这意味着如果主站部署在 Vercel：

- \`docker-compose.yml\` 只能本地跑跑，变成一个玩具
- 线上数据库（比如 Neon）和本地容器里的数据库是两套，环境不一致
- "一条命令拉起前后端及数据库"这句话讲不通

## 我选了什么

最终方案是 **Vue 3 + Express + MySQL**，全部用 Docker Compose 编排：

\`\`\`bash
docker compose up -d --build
\`\`\`

一条命令起来三个容器：nginx 托管前端、node 跑后端、mysql 存数据。这才叫真正的"一键拉起"。

## 代价是什么

坦白说，我需要自己管服务器、配 Nginx、处理证书。比 Vercel 的 \`git push\` 麻烦得多。

但换来的是**对整条链路的完全掌控** —— 出问题知道去哪查，而不是对着平台的黑盒发呆。对于一个要讲清架构的项目来说，这是值得的。`,
    },
    {
      title: 'Prisma 的多对多关系：为什么我放弃了隐式写法',
      slug: 'prisma-explicit-many-to-many',
      categorySlug: 'tech',
      tagNames: ['Prisma', 'MySQL'],
      summary: 'Prisma 提供了隐式多对多语法，写起来更短。但我最终选择了显式中间表，原因是查询能力。',
      content: `## 两种写法

Prisma 支持两种多对多建模方式。

**隐式写法**（Prisma 自动建中间表，但不暴露给你）：

\`\`\`prisma
model Article {
  id   Int   @id @default(autoincrement())
  tags Tag[]
}

model Tag {
  id        Int       @id @default(autoincrement())
  articles  Article[]
}
\`\`\`

**显式写法**（自己建中间表）：

\`\`\`prisma
model ArticleTag {
  articleId Int
  tagId     Int
  article   Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([articleId, tagId])
}
\`\`\`

## 为什么选后者

隐式写法看起来更简洁，但它有个致命限制：**中间表不可访问**。

这意味着你没法在关联上挂额外字段。比如以后想加"这篇文章打这个标签的权重"、"打标签的时间"，隐式写法直接堵死。

更重要的是查询能力。我要实现"点击标签 → 列出该标签下所有已发布文章，按发布时间排序"，用显式中间表可以写出很自然的查询：

\`\`\`typescript
const articles = await prisma.article.findMany({
  where: {
    status: 'PUBLISHED',
    tags: { some: { tag: { slug: tagSlug } } },
  },
  orderBy: { publishedAt: 'desc' },
});
\`\`\`

## 一个容易忽略的细节

中间表的主键我用的是 \`@@id([articleId, tagId])\` —— 复合主键。

它自带一个约束：同一篇文章不能重复打同一个标签。这个约束由数据库层保证，比在应用层写检查更可靠（并发下应用层检查会失效）。

## 级联删除

\`onDelete: Cascade\` 意味着删除文章时，中间表的关联记录自动清理。

如果不写这行，删文章后中间表会残留一堆指向不存在文章的孤儿记录，随着时间推移越积越多。`,
    },
    {
      title: '用 Docker Compose 编排博客全栈：踩过的三个坑',
      slug: 'docker-compose-blog-pitfalls',
      categorySlug: 'engineering',
      tagNames: ['Docker', 'Nginx', 'MySQL'],
      summary: '从「容器都起来了但访问不了」到一次 compose up 就能跑通，记录我踩过的三个坑。',
      content: `## 坑一：容器 running ≠ 服务 ready

第一次 \`docker compose up\` 的时候，三个容器状态都是 Up，但后端日志里全是连接数据库失败。

原因是 MySQL 容器虽然起来了，但**数据库初始化还没完成**。MySQL 首次启动要建数据目录、初始化系统表，这个过程通常要 10-30 秒。在这期间端口是通的，但连接会被拒绝。

后端启动得比它快，于是连不上就退出了。

**解法**：用 healthcheck + depends_on 的 condition。

\`\`\`yaml
db:
  healthcheck:
    test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
    interval: 5s
    retries: 20
    start_period: 30s

api:
  depends_on:
    db:
      condition: service_healthy   # 关键：等健康检查通过，不是等容器启动
\`\`\`

\`service_started\` 只等容器进程起来，\`service_healthy\` 才等真正可用。这个区别是致命的。

## 坑二：SPA 刷新就 404

Vue Router 用的 history 模式。首页正常，点链接跳转也正常，但**在 \`/posts/xxx\` 页面按 F5 就 404**。

原因：history 模式下 URL 是真实的路径。刷新时浏览器真的向服务器请求 \`/posts/xxx\`，而 Nginx 的目录里根本没有这个文件。

**解法**：让 Nginx 在找不到文件时返回 index.html。

\`\`\`nginx
location / {
    try_files $uri $uri/ /index.html;
}
\`\`\`

浏览器拿到 index.html，Vue Router 启动后自己解析路径，正确地渲染出文章页。

## 坑三：数据库不该暴露给公网

一开始我图方便，把 MySQL 也映射了端口：

\`\`\`yaml
db:
  ports:
    - "3306:3306"   # 危险
\`\`\`

这等于把数据库直接放到了公网上。只要密码强度不够，或者哪天有人扫到 3306 端口，数据就没了。

**解法**：只映射 web 的端口，api 和 db 靠 compose 的内部网络通信。

\`\`\`yaml
web:
  ports:
    - "8080:80"     # 只有这一个对外
# api 和 db 都不写 ports
\`\`\`

容器之间在同一个 bridge 网络里，可以用**服务名当主机名**互相访问。所以后端连数据库的地址是 \`db:3306\`，而不是 \`localhost:3306\`。

这叫「最小暴露面原则」—— 除非必要，不给任何服务开公网入口。`,
    },
  ];

  for (const a of articles) {
    await prisma.article.upsert({
      where: { slug: a.slug },
      update: {},
      create: {
        title: a.title,
        slug: a.slug,
        summary: a.summary,
        content: a.content,
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
        authorId: admin.id,
        categoryId: categories[a.categorySlug],
        tags: {
          create: a.tagNames
            .map((n) => tags[n])
            .filter((id): id is number => typeof id === 'number')
            .map((tagId) => ({ tagId })),
        },
      },
    });
  }
  console.log(`✓ 示例文章 ${articles.length} 篇`);

  console.log('\n种子数据写入完成。');
  console.log(`后台登录：用户名 ${username} / 密码 ${plainPassword}`);
}

main()
  .catch((e) => {
    console.error('种子数据写入失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
