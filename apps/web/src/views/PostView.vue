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

      
      
      <div class="content" v-html="renderedContent"></div>

      <div class="tags">
        <span v-for="tag in article.tags" :key="tag.id" class="tag">{{ tag.name }}</span>
      </div>

      <p class="back"><router-link to="/">← 返回首页</router-link></p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { fetchArticleBySlug, type Article } from '@/api/article';
import { renderMarkdown } from '@/utils/markdown';

const route = useRoute();

const article = ref<(Article & { content?: string }) | null>(null);
const loading = ref(true);
const error = ref('');

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
  margin: 40px auto;
  padding: 0 20px;
  font-family: system-ui, sans-serif;
  line-height: 1.8;
}
.meta {
  color: #999;
  font-size: 13px;
  display: flex;
  gap: 12px;
}
.content :deep(h2) {
  margin-top: 32px;
  border-bottom: 1px solid #eee;
  padding-bottom: 6px;
}
.content :deep(pre) {
  background: #282c34;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
}
.content :deep(code) {
  font-family: Consolas, Monaco, monospace;
  font-size: 14px;
}
.content :deep(p code) {
  background: #f0f0f0;
  padding: 2px 5px;
  border-radius: 3px;
  color: #c7254e;
}
.tags {
  display: flex;
  gap: 8px;
  margin: 24px 0;
}
.tag {
  font-size: 12px;
  color: #409eff;
  background: #ecf5ff;
  padding: 2px 8px;
  border-radius: 10px;
}
.back a {
  color: #409eff;
}
.error {
  color: #f56c6c;
}
</style>