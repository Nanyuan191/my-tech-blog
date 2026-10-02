import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type ThemeMode = 'light' | 'dark';

/** localStorage 里存主题选择的键名 */
const STORAGE_KEY = 'blog-theme';

/**
 * 读取初始主题：
 *   1. 用户上次手动选过 → 用他的选择
 *   2. 没选过 → 跟随操作系统（Windows/macOS 的深色设置）
 */
function readInitialMode(): ThemeMode {
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

  /** 浅色 ⇄ 深色 */
  function toggle() {
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
