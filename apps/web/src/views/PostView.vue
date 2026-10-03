<template>
  <!-- 背景层必须放在 .post 外面（兄弟节点）：
       卡片用了 backdrop-filter（毛玻璃），它会把父元素变成 fixed 后代的包含块，
       背景层若在卡片内部，position:fixed 就会失效、被裁剪进卡片范围 -->
  <!-- 背景图由后台按文章选择（bgImage 字段），bgStyle 里是翻译后的图片地址 -->
  <div class="post-bg" aria-hidden="true" :style="bgStyle"></div>
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

      <!-- 点赞：游客也能点，不需要登录。防重复用 localStorage（见脚本里的说明） -->
      <div class="actions">
        <button
          type="button"
          class="like-btn"
          :class="{ liked }"
          :disabled="liking"
          @click="handleLike"
        >
          <span class="icon">{{ liked ? '♥' : '♡' }}</span>
          <span>{{ liked ? '已点赞' : '点赞' }}</span>
          <span class="count">{{ article.likeCount }}</span>
        </button>
      </div>

      <!-- ==================== 评论区 ==================== -->
      <section class="comments">
        <h2 class="comments-title">
          评论 <span class="c-count">{{ commentTotal }}</span>
        </h2>

        <p v-if="commentsLoading && !comments.length" class="c-empty">加载中...</p>
        <p v-else-if="!comments.length" class="c-empty">还没有评论，来说点什么吧～</p>

        <ul v-else class="c-list">
          <li v-for="c in comments" :key="c.id" class="c-item" :class="{ author: c.isAuthor }">
            <div class="c-head">
              <span class="c-name">{{ c.nickname }}</span>
              <span v-if="c.isAuthor" class="c-badge">作者</span>
              <span class="c-time">{{ formatTime(c.createdAt) }}</span>
            </div>
            <!-- ⚠️ 用插值 {{ }} 而不是 v-html：评论是纯文本，插值会做转义，
                 游客写下 <script> 也只会原样显示成文字 —— 天然防 XSS -->
            <p class="c-body">{{ c.content }}</p>
          </li>
        </ul>

        <button
          v-if="hasMoreComments"
          type="button"
          class="c-more"
          :disabled="commentsLoading"
          @click="loadMoreComments"
        >
          {{ commentsLoading ? '加载中...' : '加载更多评论' }}
        </button>

        <!-- 发表评论 -->
        <div class="c-form">
          <p class="c-form-title">
            {{ isAuthorMode ? '以站长身份回复（直接显示）' : '发表评论' }}
          </p>

          <!-- 站长回复不需要填昵称邮箱：身份由 token 决定，服务端会回查数据库 -->
          <div v-if="!isAuthorMode" class="c-row">
            <input v-model="cForm.nickname" class="c-ipt" placeholder="昵称（必填）" maxlength="32" />
            <input v-model="cForm.email" class="c-ipt" placeholder="邮箱（必填，不会公开）" maxlength="191" />
          </div>

          <textarea
            v-model="cForm.content"
            class="c-ta"
            rows="4"
            maxlength="1000"
            placeholder="说点什么...（最多 1000 字）"
          ></textarea>

          <div class="c-foot">
            <span class="c-hint">
              {{ isAuthorMode ? '你的回复会立即公开' : '提交后需站长审核通过才会公开显示' }}
            </span>
            <button type="button" class="c-submit" :disabled="submitting" @click="handleSubmitComment">
              {{ submitting ? '提交中...' : '提交' }}
            </button>
          </div>
        </div>
      </section>

      <p class="back"><router-link to="/">← 返回首页</router-link></p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchArticleBySlug, likePost, type Article } from '@/api/article';
import { fetchComments, createComment, type Comment } from '@/api/comment';
import { renderMarkdown } from '@/utils/markdown';
import { resolveBackground } from '@/utils/backgrounds';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();

const article = ref<(Article & { content?: string }) | null>(null);
const loading = ref(true);
const error = ref('');

/** 文章页背景：按这篇文章的 bgImage 标识动态翻译（空 = 默认洛克图） */
const bgStyle = computed(() => ({
  backgroundImage: `url('${resolveBackground(article.value?.bgImage)}')`,
}));

/**
 * 点赞状态
 * ------------------------------------------------------------
 * 「谁点过赞」这件事服务端不知道（只有计数器，游客不登录），
 * 所以用 localStorage 记在**访客自己的浏览器**里：
 *   blog-liked:<slug> = "1"  表示这台浏览器点过这篇了
 * 局限（答辩可以主动讲）：换个浏览器/清缓存就能再点一次，
 * 属于"防误触"而不是"防刷"。要做严格去重得建 likes 表。
 */
const liked = ref(false);
const liking = ref(false);

function likedKey(slug: string) {
  return `blog-liked:${slug}`;
}

/** localStorage 在无痕模式下可能直接抛异常，所以全部包 try/catch */
function readLiked(slug: string) {
  try {
    return localStorage.getItem(likedKey(slug)) === '1';
  } catch {
    return false;
  }
}

function writeLiked(slug: string) {
  try {
    localStorage.setItem(likedKey(slug), '1');
  } catch {
    // 写不进去就算了，不影响点赞本身
  }
}

async function handleLike() {
  const slug = article.value?.slug;
  if (!slug || liking.value) return;

  if (liked.value) {
    ElMessage.info('你已经点过赞了，谢谢支持～');
    return;
  }

  liking.value = true;
  try {
    const res = await likePost(slug);
    // 用后端返回的权威计数，而不是本地 +1 —— 别人同时点赞也不会错
    if (article.value) article.value.likeCount = res.data.likeCount;
    liked.value = true;
    writeLiked(slug);
    ElMessage.success('感谢点赞！');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '点赞失败，稍后再试');
  } finally {
    liking.value = false;
  }
}

/* ==================== 评论区状态 ==================== */
/**
 * 评论的"身份"判断
 * 登录了（= 站长）就以作者身份回复，后端也只认 token，不认前端传的昵称。
 * 所以这里只是切换 UI 展示，安全性不依赖它 —— 真正的权限在后端。
 */
const isAuthorMode = computed(() => auth.isLoggedIn());

const comments = ref<Comment[]>([]);
const commentsLoading = ref(false);
const commentTotal = ref(0);
const commentTotalPages = ref(1);
const commentPage = ref(1);
const submitting = ref(false);

const cForm = reactive({ nickname: '', email: '', content: '' });

/** 还有没有下一页（后端返回的 totalPages 说了算） */
const hasMoreComments = computed(() => commentPage.value < commentTotalPages.value);

/** 一次拉 10 条，避免评论多了首屏被拖慢 */
const COMMENT_PAGE_SIZE = 10;

async function loadComments(slug: string, page = 1) {
  commentsLoading.value = true;
  try {
    const res = await fetchComments(slug, { page, pageSize: COMMENT_PAGE_SIZE });
    // 第 1 页是刷新（覆盖），后续页是追加
    comments.value = page === 1 ? res.data : [...comments.value, ...res.data];
    commentPage.value = res.pagination.page;
    commentTotal.value = res.pagination.total;
    commentTotalPages.value = res.pagination.totalPages;
  } catch {
    // 评论加载失败不该让整篇文章打不开 —— 静默降级，正文照常阅读
  } finally {
    commentsLoading.value = false;
  }
}

function loadMoreComments() {
  const slug = article.value?.slug;
  if (slug) void loadComments(slug, commentPage.value + 1);
}

async function handleSubmitComment() {
  const slug = article.value?.slug;
  if (!slug || submitting.value) return;

  if (!cForm.content.trim()) {
    ElMessage.warning('评论内容不能为空');
    return;
  }
  // 前端校验只是为了体验好；后端有同样的规则（Zod），那才是真正的闸门
  if (!isAuthorMode.value) {
    if (!cForm.nickname.trim()) {
      ElMessage.warning('请填写昵称');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cForm.email.trim())) {
      ElMessage.warning('请填写正确的邮箱');
      return;
    }
  }

  submitting.value = true;
  try {
    const res = await createComment(
      slug,
      {
        content: cForm.content.trim(),
        // 站长回复不带昵称/邮箱：后端按 token 里的 userId 回查数据库
        ...(isAuthorMode.value
          ? {}
          : { nickname: cForm.nickname.trim(), email: cForm.email.trim() }),
      },
      auth.accessToken
    );

    cForm.content = '';
    if (res.data.status === 'APPROVED') {
      ElMessage.success('回复已发布');
      await loadComments(slug, 1); // 立即刷新，能看到自己的回复
    } else {
      // 这里如实告诉游客"还没公开"，避免他刷半天以为没提交上
      ElMessage.success('评论已提交，等站长审核通过后显示');
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败，稍后再试');
  } finally {
    submitting.value = false;
  }
}

/** 评论时间格式：2026-10-02 22:40 */
function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  // 切文章时先清空上一批评论，否则会闪出旧文章的评论
  comments.value = [];
  commentTotal.value = 0;
  commentPage.value = 1;
  commentTotalPages.value = 1;

  try {
    const res = await fetchArticleBySlug(slug);
    article.value = res.data;
    // 换文章时要重新读一次"这篇我点过没"
    liked.value = readLiked(slug);
    // 评论独立加载：它失败不影响正文（内部已 try/catch）
    void loadComments(slug, 1);
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
  /* 宽度与首页共用同一个变量 → 两个页面的左右边界严丝合缝 */
  max-width: var(--content-width, 820px);
  /* 2026-10-03：页面背景改纯黑后，正文整体装进白色文本框——
     里面的文字颜色（--text-*）都是按浅底设计的，进白盒才能读清；
     黑底部分留给船长后续铺静态背景图 */
  margin: 34px auto 56px;
  padding: 34px 36px 48px;
  /* 毛玻璃白盒：白色半透明 + backdrop-filter 虚化，
     背景图（.post-bg）透过卡片变成朦胧色块，正文依然可读。
     不透明度 0.82 是可读性和透出感的平衡点，嫌"糊得不够"就往下调（最低别低于 0.7）
     （2026-10-03：曾试过"暖光+渐变去死白"，船长指正他说的单调是首页卡片，此处回滚） */
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  box-shadow: var(--card-shadow, 0 1px 2px rgba(0, 0, 0, 0.04));
  font-family: system-ui, sans-serif;
  /* 中文长文最舒服的组合：16px + 1.85 行高 */
  font-size: 16px;
  line-height: 1.85;
}
/* 文章页背景图：fixed 铺满视口、负层级垫底（白卡片之下、黑色页面底色之上），
   上面压一层 45% 黑遮罩 —— 图片只是"氛围"，不能干扰正文阅读。
   层叠上下文由 App.vue 的 .app{position:relative;z-index:0} 提供，
   否则会被 body 的纯黑底盖住（和代码雨同一个坑）。 */
.post-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  /* 图片地址来自 bgStyle（按文章的 bgImage 动态翻译）；
     这里只保留 45% 黑遮罩 —— 图片只是"氛围"，不能干扰正文阅读 */
  background: linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)) center / cover no-repeat;
}
.post h1 {
  font-size: 30px;
  line-height: 1.4;
  margin: 0 0 14px;
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

/* ==================== 评论区 ==================== */
.comments {
  margin-top: 46px;
  padding-top: 26px;
  border-top: 1px solid var(--border-soft);
}
.comments-title {
  font-size: 18px;
  margin: 0 0 18px;
}
.c-count {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
  margin-left: 4px;
}
.c-empty {
  color: var(--text-muted);
  font-size: 14px;
  padding: 14px 0;
}
.c-list {
  list-style: none;
  padding: 0;
  margin: 0 0 18px;
}
/* 每条评论：与上方导航栏同一套视觉语言（左侧细线 + 卡片底） */
.c-item {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  margin-bottom: 12px;
}
/* 站长自己的回复：换一条强调色左边框，一眼可辨 */
.c-item.author {
  border-left: 3px solid var(--accent);
}
.c-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
}
.c-name {
  font-weight: 600;
  color: var(--text-main);
}
.c-badge {
  font-size: 11px;
  line-height: 1;
  padding: 3px 7px;
  border-radius: 4px;
  color: var(--accent);
  background: var(--accent-soft);
}
.c-time {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 12px;
}
.c-body {
  margin: 0;
  color: var(--text-body);
  font-size: 15px;
  line-height: 1.75;
  /* 保留游客输入里的换行，又不让长串英文/URL 撑破容器 */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.c-more {
  display: block;
  width: 100%;
  padding: 9px 0;
  margin-bottom: 18px;
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
  color: var(--text-body);
  background: transparent;
  border: 1px dashed var(--border-soft);
  border-radius: 8px;
  transition: all 0.2s;
}
.c-more:hover:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent);
}
.c-more:disabled {
  cursor: default;
  opacity: 0.6;
}

/* ---- 发表评论表单 ---- */
.c-form {
  padding: 18px;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
}
.c-form-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}
.c-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.c-ipt,
.c-ta {
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 14px;
  color: var(--text-main);
  /* 评论表单在白色毛玻璃卡片内，输入控件必须白底深字：
     不能引用 --bg-page（黑底改版后是纯黑，深色文字会看不见） */
  background: #ffffff;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  padding: 9px 12px;
  outline: none;
  transition: border-color 0.2s;
}
.c-ipt::placeholder,
.c-ta::placeholder {
  color: #9aa3ad;
}
.c-ipt:focus,
.c-ta:focus {
  border-color: var(--accent);
}
.c-ta {
  resize: vertical;
  line-height: 1.7;
}
.c-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}
.c-hint {
  font-size: 12px;
  color: var(--text-muted);
}
.c-submit {
  flex: none;
  font-family: inherit;
  font-size: 14px;
  padding: 8px 22px;
  border-radius: 20px;
  cursor: pointer;
  color: #ffffff;
  background: var(--accent);
  border: none;
  transition: opacity 0.2s;
}
.c-submit:hover:not(:disabled) {
  opacity: 0.88;
}
.c-submit:disabled {
  cursor: default;
  opacity: 0.6;
}

/* ---- 点赞区 ---- */
.actions {
  margin: 28px 0 8px;
  display: flex;
  justify-content: center;
}
.like-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-family: inherit;
  padding: 9px 22px;
  border-radius: 22px;
  cursor: pointer;
  color: var(--text-body);
  background: transparent;
  border: 1px solid var(--border-soft);
  transition: all 0.2s;
}
.like-btn:hover:not(:disabled) {
  border-color: #f56c6c;
  color: #f56c6c;
  transform: translateY(-1px);
}
.like-btn .icon {
  font-size: 16px;
  line-height: 1;
}
.like-btn .count {
  font-weight: 600;
}
.like-btn.liked {
  color: #f56c6c;
  border-color: #f56c6c;
  background: rgba(245, 108, 108, 0.08);
}
.like-btn:disabled {
  cursor: default;
  opacity: 0.7;
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

/* ---- 手机端：字号微收、代码块左右内边距减小，避免出现横向滚动条 ---- */
@media (max-width: 640px) {
  .post {
    margin: 18px 12px 40px;
    padding: 22px 16px 34px;
    font-size: 15px;
  }
  .post h1 {
    font-size: 23px;
  }
  .content :deep(pre) {
    padding: 12px;
    border-radius: 5px;
  }
  .content :deep(code) {
    font-size: 13px;
  }
  .content :deep(table) {
    font-size: 13px;
  }
  .content :deep(th),
  .content :deep(td) {
    padding: 6px 8px;
  }
  /* 昵称/邮箱两个输入框在窄屏改成上下排列，否则挤成两条细缝 */
  .c-row {
    flex-direction: column;
  }
  .c-form {
    padding: 14px;
  }
  .c-foot {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .c-submit {
    width: 100%;
  }
}
</style>
