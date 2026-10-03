/**
 * 文章页背景图素材库 —— 单一事实源
 * ============================================================
 * 和封面图（covers.ts）同一套设计：数据库只存短标识（bg:xxx），
 * 前端读文章时用 resolveBackground() 翻译成真实图片地址。
 *
 * 为什么这样设计（答辩可讲）：
 *   - 预设图随代码进构建（Vite 会给文件名加哈希指纹），永不失效；
 *   - 新增选项 = 往数组加一行 + 丢一张图，前后台自动同步；
 *   - bgImage 为空 → 用第一项（洛克）作默认背景，老文章零迁移成本。
 */
import locke from '@/assets/backgrounds/locke.jpg';
import city from '@/assets/backgrounds/city.jpg';
import forest from '@/assets/backgrounds/forest.jpg';
import landscape from '@/assets/backgrounds/landscape.jpg';

export interface BgPreset {
  /** 存进数据库的短标识 */
  key: string;
  /** 后台选择器上显示的名字 */
  label: string;
  /** 真实图片地址（构建期由 Vite 解析） */
  url: string;
}

/** 顺序即后台选择器的展示顺序；第一项同时是"未设置背景"时的默认值 */
export const BG_PRESETS: BgPreset[] = [
  { key: 'bg:locke', label: '洛克', url: locke },
  { key: 'bg:city', label: '城市', url: city },
  { key: 'bg:forest', label: '森林', url: forest },
  { key: 'bg:landscape', label: '山水', url: landscape },
];

const BG_MAP = new Map(BG_PRESETS.map((p) => [p.key, p.url]));

/**
 * 把数据库里的 bgImage 值翻译成真实图片地址：
 * - 空值 → 默认背景（洛克）
 * - bg:xxx 标识 → 对应预设图
 * - 其他值（自定义外链 URL）→ 原样返回
 */
export function resolveBackground(value?: string | null): string {
  if (!value) return BG_PRESETS[0].url;
  return BG_MAP.get(value) ?? value;
}
