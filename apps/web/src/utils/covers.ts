/**
 * 封面图素材库（预设选项）
 * ------------------------------------------------------------------
 * 为什么要有这个文件？（答辩可讲）
 *
 * 问题：后台原来只能粘贴「图片外链 URL」，有两个痛点：
 *   ① 船长每次写文章都得先找图、传图床、复制链接，麻烦且容易填错；
 *   ② 依赖第三方图床，图床挂了首页就裂图。
 *
 * 做法：把 4 张预设图打进前端产物（Vite 会做哈希+压缩），
 * 后台点缩略图选择，数据库里只存一个「短标识」而不是长 URL：
 *
 *      数据库 coverImage 字段 = "cover:scifi"   ← 存标识
 *              ↓ 读的时候翻译
 *      首页 <img src="/assets/scifi-8f3a2b.jpg"> ← 显示真图
 *
 * 好处：
 *   ① 预设图跟着代码走，永远不失效，还能被浏览器缓存；
 *   ② 换图/加选项只改这一个文件，前后台同步生效；
 *   ③ 「自定义 URL」照样保留 —— 预设解决 90% 场景，外链兜住长尾。
 */
import childhood from '@/assets/covers/childhood.jpg';
import scifi from '@/assets/covers/scifi.jpg';
import nature from '@/assets/covers/nature.jpg';
import tech from '@/assets/covers/tech.jpg';

export interface CoverPreset {
  /** 存进数据库的标识（带 cover: 前缀，用来跟自定义 URL 区分） */
  key: string;
  /** 后台选项上显示的名字 */
  label: string;
  /** 前端实际加载的图片地址（Vite 构建后是带哈希的静态资源路径） */
  url: string;
}

/** 预设封面清单：以后要加选项，在这里加一行即可（记得把图放进 assets/covers/） */
export const COVER_PRESETS: CoverPreset[] = [
  { key: 'cover:childhood', label: '童年', url: childhood },
  { key: 'cover:scifi', label: '科幻', url: scifi },
  { key: 'cover:nature', label: '自然', url: nature },
  { key: 'cover:tech', label: '技术', url: tech },
];

/** key → 图片地址 的查找表，避免每次遍历数组 */
const PRESET_MAP = new Map(COVER_PRESETS.map((p) => [p.key, p.url]));

/** 判断一个 coverImage 值是不是预设标识（而不是 http(s) 外链） */
export function isPresetCover(value?: string | null): boolean {
  return !!value && PRESET_MAP.has(value);
}

/**
 * 把数据库里的 coverImage 值翻译成浏览器能加载的图片地址。
 * - 预设标识（cover:xxx）→ 对应的内置图片
 * - 自定义外链（https://...）→ 原样返回
 * - 空值 → 空字符串（调用方据此显示渐变色兜底块）
 */
export function resolveCover(value?: string | null): string {
  if (!value) return '';
  return PRESET_MAP.get(value) ?? value;
}
