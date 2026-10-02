<template>
  <div class="wrap">
    <!--
      头部横幅：背景是一张压缩到 48KB 的抽象图（src/assets/hero-banner.jpg），
      上面压一层「左深右透」的渐变遮罩（.hero::before）——
      遮罩的作用：保证左边白字在任何图上都读得清，这是"图文横幅"的标准做法。
    -->
    <header class="hero">
      <div class="hero-text">
        <h1>我的技术博客</h1>
        <p class="hero-sub">记录开发过程中的思考与实践 —— Vue · Node · Docker</p>
      </div>
    </header>

    <p v-if="loading">加载中...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <div v-else-if="articles.length" class="list">
      <article v-for="item in articles" :key="item.id" class="card">
        <!--
          缩略图兜底策略（答辩可讲）：
          ① 文章填了 coverImage → 显示真图（img + loading=lazy 懒加载）
          ② 没填 → 按 id 轮换 3 套渐变色 + 显示「分类首字」当装饰字
          这样数据库一个字段都不用改，列表永远不会出现"裂图"。
        -->
        <div class="thumb" :class="`tc-${item.id % 3}`">
          <img
            v-if="item.coverImage"
            class="thumb-img"
            :src="item.coverImage"
            :alt="item.title"
            loading="lazy"
          />
          <span v-else class="thumb-letter">{{ thumbLetter(item) }}</span>
        </div>

        <div class="card-body">
          <h2>
            <router-link :to="`/posts/${item.slug}`">{{ item.title }}</router-link>
          </h2>
          <p class="meta">
            <span v-if="item.category" class="cat">{{ item.category.name }}</span>
            <span>{{ formatDate(item.publishedAt) }}</span>
            <span>阅读 {{ item.viewCount }}</span>
            <span v-if="item.likeCount > 0">点赞 {{ item.likeCount }}</span>
          </p>
          <p class="summary">{{ item.summary }}</p>
          <p class="tags">
            <span v-for="tag in item.tags" :key="tag.id" class="tag">{{ tag.name }}</span>
          </p>
        </div>
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

/** 缩略图兜底字：优先分类首字，没分类就用标题首字（trim 防空格开头） */
function thumbLetter(item: Article): string {
  return (item.category?.name || item.title || '#').trim().slice(0, 1);
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
  /* 列表页比阅读页更宽（960px），容纳左图右文的卡片 */
  max-width: var(--content-width-wide, 960px);
  margin: 0 auto;
  padding: 0 20px 56px;
  font-family: system-ui, sans-serif;
}

/* ---- 头部横幅：背景图 + 渐变遮罩 + 白字 ---- */
.hero {
  position: relative;
  height: 260px;
  border-radius: 16px;
  overflow: hidden; /* 背景图跟着圆角裁掉 */
  margin: 28px 0 30px;
  background-image: url('../assets/hero-banner.jpg');
  background-size: cover; /* 等比放大铺满，任何窗口宽度都不变形 */
  background-position: center right; /* 网络光点在图右侧，优先展示 */
}
/* 遮罩：左深右透 —— 左边白字可读，右边图形露出 */
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(10, 16, 32, 0.72) 0%,
    rgba(10, 16, 32, 0.38) 46%,
    rgba(10, 16, 32, 0.05) 82%
  );
}
.hero-text {
  position: relative; /* 压在遮罩之上（遮罩 z 序低于 relative 内容） */
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center; /* 垂直居中 */
  padding: 0 40px;
}
.hero h1 {
  margin: 0 0 12px;
  font-size: 32px;
  letter-spacing: 0.5px;
  color: #ffffff;
}
.hero-sub {
  margin: 0;
  color: rgba(255, 255, 255, 0.85);
  font-size: 15px;
}

/* ---- 文章卡片：左图右文 ---- */
.list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.card {
  display: flex;
  align-items: flex-start;
  gap: 22px;
  padding: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  box-shadow: var(--card-shadow, 0 1px 2px rgba(0, 0, 0, 0.04));
  /* 过渡要写在常态上：hover 才有平滑的进/出两个方向的动画 */
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--card-shadow-hover, 0 10px 26px rgba(0, 0, 0, 0.1));
  border-color: var(--accent);
}

/* 缩略图：固定尺寸 + 圆角裁切；img 用 object-fit 防拉伸变形 */
.thumb {
  width: 172px;
  height: 118px;
  border-radius: 10px;
  overflow: hidden;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover; /* 图片比例不对时裁切填满，不会压扁 */
  display: block;
}
.thumb-letter {
  font-size: 34px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1;
}
/* 三套兜底配色：按文章 id 轮换，同一篇永远同一个颜色 */
.tc-0 {
  background: linear-gradient(135deg, #3a7bd5 0%, #7c5cf0 100%);
}
.tc-1 {
  background: linear-gradient(135deg, #149a80 0%, #5dcaa5 100%);
}
.tc-2 {
  background: linear-gradient(135deg, #d85a30 0%, #ef9f27 100%);
}

.card-body {
  flex: 1;
  min-width: 0; /* 允许内部文字正常换行，防止长标题把布局撑爆 */
}
.card h2 {
  margin: 2px 0 10px;
  font-size: 21px;
  line-height: 1.45;
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
  /* 摘要最多两行，超出显示省略号（-webkit-line-clamp 是现行标准做法） */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

/* ---- 手机端：卡片改成"小图在上、文字在下"的紧凑版 ---- */
@media (max-width: 640px) {
  .wrap {
    padding: 0 14px 40px;
  }
  .hero {
    height: 190px;
    margin: 18px 0 22px;
    border-radius: 12px;
  }
  .hero-text {
    padding: 0 22px;
  }
  .hero h1 {
    font-size: 23px;
  }
  .hero-sub {
    font-size: 13px;
  }
  .card {
    gap: 14px;
    padding: 16px;
  }
  .thumb {
    width: 88px;
    height: 88px;
    border-radius: 8px;
  }
  .thumb-letter {
    font-size: 24px;
  }
  .card h2 {
    font-size: 17px;
  }
  .meta {
    flex-wrap: wrap;
    gap: 8px;
  }
  .summary {
    font-size: 14px;
    line-height: 1.65;
  }
}
</style>
