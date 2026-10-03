<template>
  <div class="notes">
    <!-- 页面标题：直接浮在纯黑代码雨背景上（雨由 App.vue 按路由控制） -->
    <h1>刻在不知名角落的话</h1>

    <!-- 白色文本框：网站说明 + 博主的话。想加内容就在框里加 <h2>/<p> -->
    <div class="note-card">
      <h2>关于这个网站</h2>
      <p>
        这里是我的个人技术博客，用来存放我在学习和做项目过程中的记录与思考。————鸢
      </p>

      <h2>博主的话</h2>
      <p>
       谨以此站，记录我的生活成长中的一点一滴
      </p>
      <p>
        如果你也在做类似的东西，欢迎交流。
      </p>

      <h2>联系方式</h2>
      <p>
        GitHub：<a href="https://github.com/Nanyuan191" target="_blank" rel="noopener">Nanyuan191</a>
      </p>
    </div>

    <p class="back"><router-link to="/">← 返回首页</router-link></p>
  </div>
</template>

<script setup lang="ts">
/**
 * 特殊页：网站说明 + 博主的话（2026-10-03 新增）
 * 这是一个纯静态页面：内容写死在这里，不经过数据库和接口，
 * 改文案只需要改这个文件的模板部分。
 * 背景：纯黑 + 二进制代码雨（是否下雨由 App.vue 根据路由决定）。
 */
</script>

<style scoped>
.notes {
  max-width: var(--content-width, 760px);
  margin: 0 auto;
  padding: 64px 20px 72px;
  font-family: system-ui, sans-serif;
}
.notes h1 {
  margin: 0 0 30px;
  text-align: center;
  font-size: 32px;
  letter-spacing: 2px;
  color: #f5f7fa; /* 黑底上必须用亮色 */
  text-shadow: 0 0 24px rgba(64, 158, 255, 0.35);
}
/* 毛玻璃文本框：和文章页 .post 同一套配方（82% 半透明白 + backdrop 虚化），
   黑底代码雨隔着卡片化作朦胧蓝色光点，文字依然清晰可读 */
.note-card {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  padding: 30px 34px 36px;
  box-shadow: var(--card-shadow, 0 1px 2px rgba(0, 0, 0, 0.04));
}
.note-card h2 {
  margin: 26px 0 10px;
  font-size: 19px;
  color: var(--text-main);
}
.note-card h2:first-child {
  margin-top: 0;
}
.note-card p {
  margin: 0 0 10px;
  line-height: 1.85;
  color: var(--text-body);
}
.note-card a {
  color: var(--accent);
  text-decoration: none;
}
.note-card a:hover {
  text-decoration: underline;
}
.back {
  margin-top: 32px;
  text-align: center;
  font-size: 14px;
}
.back a {
  color: rgba(255, 255, 255, 0.55);
  text-decoration: none;
}
.back a:hover {
  color: var(--accent);
}

/* ---- 手机端 ---- */
@media (max-width: 640px) {
  .notes {
    padding: 44px 14px 56px;
  }
  .notes h1 {
    font-size: 25px;
  }
  .note-card {
    padding: 22px 18px 26px;
  }
}
</style>
