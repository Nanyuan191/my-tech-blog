<template>
  <div class="wrap">
    <!-- 头部横幅：静态结构，不依赖任何数据 -->
    <header class="hero">
      <h1>我的技术博客</h1>
      <p class="hero-sub">记录开发过程中的思考与实践 —— Vue · Node · Docker</p>
    </header>

    <p v-if="loading">加载中...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <div v-else-if="articles.length" class="list">
      <article v-for="item in articles" :key="item.id" class="card">
        <h2>
          <router-link :to="`/posts/${item.slug}`">{{ item.title }}</router-link>
        </h2>
        <p class="meta">
          <span v-if="item.category" class="cat">{{ item.category.name }}</span>
          <span>{{ formatDate(item.publishedAt) }}</span>
          <span>阅读 {{ item.viewCount }}</span>
        </p>
        <p class="summary">{{ item.summary }}</p>
        <p class="tags">
          <span v-for="tag in item.tags" :key="tag.id" class="tag">{{ tag.name }}</span>
        </p>
      </article>
    </div>

    <p v-else class="empty">还没有文章。</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchArticles, type Article } from '@/api/article';

// ⭐ 三个状态：数据 / 加载中 / 错误
//    这是调接口的标准套路，后面每个页面都这么写
const articles = ref<Article[]>([]);
const loading = ref(true);
const error = ref('');

function formatDate(value: string | null) {
  if (!value) return '未发布';
  return value.slice(0, 10);
}

// onMounted：组件挂载完成后执行，用来拉初始数据
onMounted(async () => {
  try {
    const res = await fetchArticles({ page: 1, pageSize: 10 });
    articles.value = res.data;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    // finally 保证无论成功失败都关掉 loading
    loading.value = false;
  }
});
</script>

<style scoped>
.wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 20px 40px;
  font-family: system-ui, sans-serif;
}

/* ---- 头部横幅 ---- */
.hero {
  padding: 44px 0 12px;
  border-bottom: 1px solid var(--border-soft);
  margin-bottom: 24px;
}
.hero h1 {
  margin: 0 0 8px;
  font-size: 30px;
  letter-spacing: 0.5px;
}
/* 标题左侧的强调竖条：纯 CSS，不用图片 */
.hero h1::before {
  content: '';
  display: inline-block;
  width: 5px;
  height: 24px;
  margin-right: 12px;
  border-radius: 3px;
  background: var(--accent);
  vertical-align: -2px;
}
.hero-sub {
  margin: 0 0 20px;
  color: var(--text-muted);
  font-size: 14px;
}

/* ---- 文章卡片：从"分隔线列表"升级为"悬浮卡片" ---- */
.list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  padding: 20px 24px;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  /* 过渡要写在常态上：hover 才有平滑的进/出两个方向的动画 */
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  border-color: var(--accent);
}
.card h2 {
  margin: 0 0 8px;
  font-size: 20px;
}
.card h2 a {
  color: var(--text-main);
  text-decoration: none;
}
.card h2 a:hover {
  color: var(--accent);
}
.meta {
  color: var(--text-muted);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 10px;
}
/* 分类做成小徽章，和普通 meta 信息区分开 */
.cat {
  color: var(--accent);
  background: var(--accent-soft);
  padding: 1px 10px;
  border-radius: 10px;
}
.summary {
  color: var(--text-body);
  line-height: 1.7;
  margin: 0 0 10px;
}
.tags {
  display: flex;
  gap: 8px;
  margin: 0;
}
.tag {
  font-size: 12px;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 2px 8px;
  border-radius: 10px;
}
.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 60px 0;
}
.error {
  color: #f56c6c;
}
</style>
