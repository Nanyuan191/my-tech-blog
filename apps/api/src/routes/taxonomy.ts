import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { wrap } from '../middlewares/errorHandler';
import { AppError } from '../middlewares/errorHandler';

/**
 * 分类与标签路由
 * ------------------------------------------------------------
 * 这两类数据是「字典表」：数量少、变动少、几乎只增删不改。
 * 所以接口设计得很简单，读接口全部公开（前台要用来做筛选），
 * 写接口全部需要登录（只有管理员能维护）。
 */

const categoryRouter = Router();

// ---- 公开：分类列表（前台左侧导航用） ----
categoryRouter.get(
  '/',
  wrap(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        // 只统计已发布的文章数 —— 否则前台会显示"技术分类下有 5 篇"
        // 但点进去只看到 3 篇（另外 2 篇是草稿），体验很怪
        _count: {
          select: { articles: { where: { status: 'PUBLISHED' } } },
        },
      },
    });

    res.json({
      success: true,
      // _count 默认是 { articles: 3 } 的结构，压平成 articleCount 前端更好用
      data: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        sortOrder: c.sortOrder,
        articleCount: c._count.articles,
      })),
    });
  })
);

// ---- 后台：新增分类 ----
categoryRouter.post(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    const { name, slug, description, sortOrder } = req.body ?? {};
    if (!name) throw AppError.badRequest('分类名不能为空');

    const category = await prisma.category.create({
      data: {
        name,
        // 没传 slug 就用名字生成（小写 + 连字符）
        slug: slug ?? name.toLowerCase().replace(/\s+/g, '-'),
        description,
        sortOrder: Number(sortOrder) || 0,
      },
    });

    res.status(201).json({ success: true, data: category });
  })
);

// ---- 后台：改名 / 改排序 ----
categoryRouter.put(
  '/:id',
  requireAuth,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const { name, slug, description, sortOrder } = req.body ?? {};

    const category = await prisma.category.update({
      where: { id },
      data: { name, slug, description, sortOrder },
    });

    res.json({ success: true, data: category });
  })
);

// ---- 后台：删除分类 ----
categoryRouter.delete(
  '/:id',
  requireAuth,
  wrap(async (req, res) => {
    const id = Number(req.params.id);

    // 这里有个业务决策：分类下有文章时，不允许直接删。
    // 因为 schema 里设的是 onDelete: SetNull（文章变成"未分类"），
    // 对作者来说这可能是意外结果 —— 不如直接拦住，让作者先处理文章。
    const count = await prisma.article.count({ where: { categoryId: id } });
    if (count > 0) {
      throw AppError.badRequest(`该分类下还有 ${count} 篇文章，请先移出后再删除`);
    }

    await prisma.category.delete({ where: { id } });
    res.json({ success: true, message: '删除成功' });
  })
);

// ============ 标签 ============

const tagRouter = Router();

// ---- 公开：标签列表（前台标签云用） ----
tagRouter.get(
  '/',
  wrap(async (_req, res) => {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { articles: true } },
      },
    });

    res.json({
      success: true,
      // 只保留有文章在用的标签，避免前台出现一堆"0 篇"的空标签
      data: tags
        .map((t) => ({ id: t.id, name: t.name, slug: t.slug, articleCount: t._count.articles }))
        .filter((t) => t.articleCount > 0),
    });
  })
);

tagRouter.post(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    const { name, slug } = req.body ?? {};
    if (!name) throw AppError.badRequest('标签名不能为空');

    const tag = await prisma.tag.create({
      data: { name, slug: slug ?? name.toLowerCase().replace(/\s+/g, '-') },
    });

    res.status(201).json({ success: true, data: tag });
  })
);

tagRouter.delete(
  '/:id',
  requireAuth,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    // 标签和文章是多对多，删标签不会影响文章本身，
    // 只是解除关联（中间表的 ON DELETE CASCADE 会自动清理），所以可以直接删
    await prisma.tag.delete({ where: { id } });
    res.json({ success: true, message: '删除成功' });
  })
);

export { categoryRouter, tagRouter };
