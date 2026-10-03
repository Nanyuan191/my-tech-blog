<template>
  <div class="wrap">
    <!--
      头部区（2026-10-03 重铸）：不再用"深色大盒子+背景图"，
      改为无框设计 —— 大标题 + 副标题居中置顶，直接浮在纯黑代码雨背景上，
      下方刻意留出一大片空白，给后续内容（签名档/统计/精选）预留位置。
    -->
    <header class="hero">
      <h1>记忆封存之处</h1>
      <p class="hero-sub">将我的记忆弃置于此</p>
    </header>

    <!--
      副标题下的小链接：放在 header 外面、与文章卡片同级 ——
      这样左边缘和卡片严丝合缝（两者共用 .wrap 的同一层内边距）
    -->
    <div class="hero-links">
      <router-link class="hero-link" to="/notes">刻在不知名角落的话</router-link>
    </div>

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

/* ---- 头部区：无框居中，浮在纯黑代码雨背景上 ---- */
.hero {
  text-align: center;
  /* 上方留出"抬头"的呼吸感；下方的大 padding 就是给后续内容预留的空白 */
  padding: 88px 20px 110px;
}
.hero h1 {
  margin: 0 0 18px;
  font-size: 44px;
  font-weight: 600;
  letter-spacing: 3px;
  color: #f5f7fa; /* 纯黑背景上必须用亮色，不能用 var(--text-main)（那是深色字） */
  text-shadow: 0 0 24px rgba(64, 158, 255, 0.35); /* 淡淡的蓝色光晕，和代码雨呼应 */
}
.hero-sub {
  margin: 0;
  color: rgba(255, 255, 255, 0.55);
  font-size: 15px;
  letter-spacing: 1px;
}
/* 副标题下的小链接：与文章卡片同级、左边缘对齐，低调不抢标题 */
.hero-links {
  margin: -40px 0 34px;
  text-align: left;
}
.hero-link {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  text-decoration: none;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.3);
  transition: color 0.2s ease, border-color 0.2s ease;
}
.hero-link:hover {
  color: var(--accent, #409eff);
  border-color: var(--accent, #409eff);
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
    padding: 56px 16px 72px;
  }
  .hero h1 {
    font-size: 30px;
    letter-spacing: 2px;
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
