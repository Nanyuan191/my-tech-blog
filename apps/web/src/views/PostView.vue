<template>
  <div class="post">
    <p v-if="loading">加载中...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else-if="article">
      <h1>{{ article.title }}</h1>
      <p class="meta">
        <span v-if="article.category">{{ article.category.name }}</span>
        <span>{{ formatDate(article.publishedAt) }}</span>
        <span>阅读 {{ article.viewCount }}</span>
      </p>

      <!-- ref="contentEl"：拿到这个 div 的 DOM 引用，才能在渲染后往代码块里加复制按钮 -->
      <div ref="contentEl" class="content" v-html="renderedContent"></div>

      <div class="tags">
        <span v-for="tag in article.tags" :key="tag.id" class="tag">{{ tag.name }}</span>
      </div>

      <p class="back"><router-link to="/">← 返回首页</router-link></p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { fetchArticleBySlug, type Article } from '@/api/article';
import { renderMarkdown } from '@/utils/markdown';

const route = useRoute();

const article = ref<(Article & { content?: string }) | null>(null);
const loading = ref(true);
const error = ref('');

/** .content 这个 div 的 DOM 引用（模板里 ref="contentEl" 对应这里） */
const contentEl = ref<HTMLElement | null>(null);

// computed：article 变化时自动重新计算
const renderedContent = computed(() =>
  article.value?.content ? renderMarkdown(article.value.content) : ''
);

function formatDate(value: string | null) {
  if (!value) return '未发布';
  return value.slice(0, 10);
}

async function loadArticle(slug: string) {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetchArticleBySlug(slug);
    article.value = res.data;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

/**
 * 复制文本到剪贴板 —— 带「环境降级」的三段式写法（答辩可讲的点）：
 *
 * 1. 首选 navigator.clipboard（Clipboard API）
 *    ⚠️ 但浏览器规定它只在「安全上下文」存在：HTTPS 或 localhost。
 *    我们线上是 http://129.28.26.104:8080，属于非安全上下文，
 *    这个 API 很可能是 undefined，直接调用会报错。
 * 2. 所以先判断 navigator.clipboard && window.isSecureContext 存在才用。
 * 3. 不满足条件就走降级：动态建一个看不见的 <textarea>，
 *    选中后调 document.execCommand('copy')（老 API，http 下也能用）。
 */
async function copyText(text: string): Promise<boolean> {
  // 第一优先：现代剪贴板 API（仅安全上下文可用）
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 用户拒授权等异常 → 落到下面的降级方案
    }
  }

  // 降级：老式 textarea + execCommand（http 环境下唯一可靠的方式）
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0'; // 藏起来，但不能 display:none（选不中）
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

/**
 * 给文章里每个代码块（<pre>）加一个「复制」按钮。
 *
 * 为什么不能用 v-html 直接加按钮？
 *   v-html 里塞的只是 HTML 字符串，事件绑定（@click）不会生效 ——
 *   Vue 不会编译 v-html 内部的代码。
 * 所以用「渲染后增强」：等内容真正进入 DOM 后（nextTick），
 * 手动把每个 <pre> 包进一层容器，再插入按钮、用 addEventListener 绑事件。
 */
function enhanceCodeBlocks() {
  const root = contentEl.value;
  if (!root) return;

  root.querySelectorAll('pre').forEach((pre) => {
    // 已处理过的跳过（防止重复包一层）
    if (pre.parentElement?.classList.contains('pre-box')) return;

    // 把 <pre> 包进 <div class="pre-box">，按钮才能绝对定位到它的右上角
    const box = document.createElement('div');
    box.className = 'pre-box';
    pre.parentNode?.insertBefore(box, pre);
    box.appendChild(pre);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = '复制';
    btn.addEventListener('click', async () => {
      const ok = await copyText(pre.innerText);
      btn.textContent = ok ? '已复制 ✓' : '复制失败';
      btn.classList.toggle('done', ok);
      setTimeout(() => {
        btn.textContent = '复制';
        btn.classList.remove('done');
      }, 1500);
    });
    box.appendChild(btn);
  });
}

// 内容一变（首次加载、切换文章），等 DOM 更新完就增强一次
watch(renderedContent, async () => {
  await nextTick();
  enhanceCodeBlocks();
});

// ⚠️ 必须用 watch，不能只在 onMounted 里调！
// 因为从 /posts/a 跳到 /posts/b 时组件不会重建，
// onMounted 不会重跑，数据就不更新了。
watch(
  () => route.params.slug,
  (slug) => {
    if (slug) loadArticle(slug as string);
  },
  { immediate: true } // immediate 让首次进入也执行
);
</script>

<style scoped>
.post {
  max-width: 760px;
  margin: 0 auto;
  padding: 40px 20px 60px;
  font-family: system-ui, sans-serif;
  line-height: 1.8;
}
.post h1 {
  font-size: 28px;
  line-height: 1.4;
  margin: 0 0 12px;
}
.meta {
  color: var(--text-muted);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-soft);
  margin-bottom: 28px;
}
.content :deep(h2) {
  margin-top: 36px;
  border-bottom: 1px solid var(--border-soft);
  padding-bottom: 6px;
}
.content :deep(h3) {
  margin-top: 28px;
}
/* 引用块：左侧强调条 + 柔和底色，颜色跟随主题变量 */
.content :deep(blockquote) {
  margin: 16px 0;
  padding: 10px 16px;
  border-left: 4px solid var(--accent);
  background: var(--bg-subtle);
  border-radius: 0 8px 8px 0;
  color: var(--text-body);
}
.content :deep(blockquote p) {
  margin: 4px 0;
}
.content :deep(a) {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px dashed var(--accent);
}
.content :deep(ul),
.content :deep(ol) {
  padding-left: 24px;
}
.content :deep(li) {
  margin: 4px 0;
}
.content :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-soft);
  margin: 28px 0;
}
/* 表格：细边框 + 斑马纹，宽度撑满 */
.content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
  font-size: 14px;
}
.content :deep(th),
.content :deep(td) {
  border: 1px solid var(--border-soft);
  padding: 8px 12px;
  text-align: left;
}
.content :deep(th) {
  background: var(--bg-subtle);
}
/* 文章里插的图片不能把手机屏幕撑爆 */
.content :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}
.content :deep(pre) {
  background: #282c34;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  line-height: 1.6;
}
.content :deep(code) {
  font-family: Consolas, Monaco, monospace;
  font-size: 14px;
}
.content :deep(p code) {
  background: var(--code-inline-bg);
  padding: 2px 5px;
  border-radius: 3px;
  color: var(--code-inline-text);
}

/* ↓↓↓ 代码块复制按钮（按钮是 JS 动态创建的，没有 scoped 的 data 属性，
   所以必须写在 :deep() 里才能命中）↓↓↓ */
.content :deep(.pre-box) {
  position: relative; /* 按钮的定位基准 */
}
.content :deep(.copy-btn) {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  color: #d0d3d8;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.25);
  transition: all 0.2s;
}
.content :deep(.copy-btn:hover) {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.6);
}
.content :deep(.copy-btn.done) {
  color: #67c23a;
  border-color: #67c23a;
}

.tags {
  display: flex;
  gap: 8px;
  margin: 24px 0;
}
.tag {
  font-size: 12px;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 2px 8px;
  border-radius: 10px;
}
.back {
  margin-top: 32px;
  font-size: 14px;
}
.back a {
  color: var(--accent);
  text-decoration: none;
}
.back a:hover {
  text-decoration: underline;
}
.error {
  color: #f56c6c;
}
</style>
