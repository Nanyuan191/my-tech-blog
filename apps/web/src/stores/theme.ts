import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type ThemeMode = 'light' | 'dark';

/** localStorage 里存主题选择的键名 */
const STORAGE_KEY = 'blog-theme';

/**
 * 深色模式总开关（2026-10-03 暂时下线）
 * 设为 false 后：强制浅色、toggle() 失效 —— 配合导航栏里已注释的切换按钮。
 * 注意必须和 index.html 里防闪白脚本的 DARK_MODE_ENABLED 保持一致，
 * 否则深色系统的访客会先闪一下深色再被掰回浅色。
 */
const DARK_MODE_ENABLED = false;

/**
 * 读取初始主题：
 *   1. 用户上次手动选过 → 用他的选择
 *   2. 没选过 → 跟随操作系统（Windows/macOS 的深色设置）
 */
function readInitialMode(): ThemeMode {
  if (!DARK_MODE_ENABLED) return 'light';

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

/**
 * 主题管理
 *
 * 核心思路：只操作一个地方 —— 给 <html> 加/删 `dark` 这个 class。
 * 加上了，theme.css 里 html.dark 那套变量生效，Element Plus 的深色变量也生效，
 * 整站跟着变；删掉就回到浅色。不用逐个组件去改。
 */
export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readInitialMode());

  /** 把当前模式贴到 <html> 上（documentElement 就是 <html> 这个标签） */
  function applyToHtml() {
    const el = document.documentElement;
    if (mode.value === 'dark') {
      el.classList.add('dark');
    } else {
      el.classList.remove('dark');
    }
  }

  /** 浅色 ⇄ 深色（深色模式暂时下线：开关关闭时此函数不做事） */
  function toggle() {
    if (!DARK_MODE_ENABLED) return;
    mode.value = mode.value === 'dark' ? 'light' : 'dark';
  }

  /**
   * 监听 mode：一变就「贴 class + 存 localStorage」
   * immediate: true 让 store 一创建就先套用一次，
   * 否则刚进页面时 html 上还没有 dark，会先闪一下浅色。
   */
  watch(
    mode,
    () => {
      applyToHtml();
      localStorage.setItem(STORAGE_KEY, mode.value);
    },
    { immediate: true },
  );

  return { mode, toggle };
});
