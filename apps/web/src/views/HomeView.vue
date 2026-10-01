<template>
  <div class="wrap">
    <h1>我的技术博客</h1>

    <p v-if="loading">加载中...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <div v-else-if="articles.length">
      <article v-for="item in articles" :key="item.id" class="card">
        <h2>
          <router-link :to="`/posts/${item.slug}`">{{ item.title }}</router-link>
        </h2>
        <p class="meta">
          <span v-if="item.category">{{ item.category.name }}</span>
          <span>{{ formatDate(item.publishedAt) }}</span>
          <span>阅读 {{ item.viewCount }}</span>
        </p>
        <p class="summary">{{ item.summary }}</p>
        <p class="tags">
          <span v-for="tag in item.tags" :key="tag.id" class="tag">{{ tag.name }}</span>
        </p>
      </article>
    </div>

    <p v-else>还没有文章。</p>
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
  margin: 40px auto;
  padding: 0 20px;
  font-family: system-ui, sans-serif;
}
.card {
  padding: 20px 0;
  border-bottom: 1px solid #eee;
}
.card h2 {
  margin: 0 0 8px;
  font-size: 20px;
}
.card h2 a {
  color: #1a1a1a;
  text-decoration: none;
}
.card h2 a:hover {
  color: #409eff;
}
.meta {
  color: #999;
  font-size: 13px;
  display: flex;
  gap: 12px;
  margin: 0 0 8px;
}
.summary {
  color: #555;
  line-height: 1.7;
  margin: 0 0 8px;
}
.tags {
  display: flex;
  gap: 8px;
}
.tag {
  font-size: 12px;
  color: #409eff;
  background: #ecf5ff;
  padding: 2px 8px;
  border-radius: 10px;
}
.error {
  color: #f56c6c;
}
</style>