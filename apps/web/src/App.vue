<template>
  <div class="app">
    <!-- 顶部阅读进度条：宽度 = 当前阅读百分比（JS 里算） -->
    <div class="progress" :style="{ width: progress + '%' }"></div>

    <!--
      顶部导航栏：写在 App.vue 里 = 所有页面自动带上，不用每个页面都写一遍。
      第 2 项「深色模式」会在 :root / html.dark 里定义 --nav-* 这组变量，
      现在样式里的 var(--nav-bg, #ffffff) 是「带默认值的变量」写法：
      变量没定义就用后面的默认色，定义了就自动跟随深色主题，不用回来改这个文件。
    -->
    <header class="navbar">
      <router-link class="brand" to="/">我的技术博客</router-link>

      <nav class="links">
        <router-link class="link" to="/">首页</router-link>
        <!-- 只有登录后才显示「后台」和「改密码」入口 -->
        <router-link v-if="auth.isLoggedIn()" class="link" to="/admin">后台</router-link>
        <router-link v-if="auth.isLoggedIn()" class="link" to="/change-password">改密码</router-link>
      </nav>

      <div class="right">
        <!--
          深色 / 浅色切换：点一下只是给 <html> 加或删一个 class，
          全站颜色（含 Element Plus 组件）跟着变，不用刷新页面。
        -->
        <button class="btn ghost" @click="theme.toggle()">
          {{ theme.mode === 'dark' ? '浅色' : '深色' }}
        </button>
        <template v-if="auth.isLoggedIn()">
          <span class="who">{{ auth.user?.nickname || auth.user?.username || '已登录' }}</span>
          <button class="btn ghost" @click="handleLogout">退出</button>
        </template>
        <router-link v-else class="btn solid" to="/login">登录</router-link>
      </div>
    </header>

    <main class="main">
      <router-view />
    </main>

    <!-- 回到顶部：滚动超过一屏才出现，避免一进页面就挡视线 -->
    <transition name="fade">
      <button v-if="showTop" class="to-top" title="回到顶部" @click="backToTop">↑</button>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';

/**
 * 本文件要点（答辩可能被问到）：
 * 1. ⚠️ auth.isLoggedIn 是「函数」不是「属性」，模板里必须写 isLoggedIn() 带括号。
 *    漏掉括号不会报错 —— 因为函数对象本身永远是真值，
 *    结果就是「没登录也显示后台入口和退出按钮」，属于静默 bug。
 * 2. 导航栏放在 App.vue，靠 router-view 实现「外壳不变、中间内容切换」，
 *    这是 SPA 的典型布局方式。
 */
const router = useRouter();
const auth = useAuthStore();
const theme = useThemeStore();

/** 退出登录：清后端 Cookie + 清本地内存里的 token，然后跳回首页 */
async function handleLogout() {
  await auth.logout();
  router.push('/');
}

// ---- 阅读进度条 + 回到顶部（两者共用同一个 scroll 事件，只监听一次）----
const progress = ref(0);
const showTop = ref(false);

/**
 * 进度计算公式：已滚动距离 ÷ 还能滚的距离
 * ⚠️ 分母必须是 (scrollHeight - clientHeight)，不能只用 scrollHeight ——
 *    否则滚到底也只到 80% 左右，永远到不了 100%。
 */
function onScroll() {
  const el = document.documentElement;
  const max = el.scrollHeight - el.clientHeight;
  progress.value = max > 50 ? Math.min(100, (el.scrollTop / max) * 100) : 0;
  showTop.value = el.scrollTop > 320;
}

function backToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => {
  // passive: true 告诉浏览器这个监听器不会 preventDefault，
  // 滚动时可以少一层检查，滑起来更顺
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
});
// 组件销毁时解绑，防止内存泄漏（App.vue 一般不会销毁，但这是好习惯）
onUnmounted(() => window.removeEventListener('scroll', onScroll));
</script>

<style scoped>
/* ---- 阅读进度条：贴在最顶端的一条细线 ---- */
.progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  background: var(--accent);
  z-index: 200; /* 必须比导航栏(100)高，否则被盖住 */
  transition: width 0.08s linear;
}

.navbar {
  display: flex;
  align-items: center;
  gap: 20px;
  height: var(--nav-height, 60px);
  padding: 0 24px;
  /* 半透明底 + 毛玻璃：滚动时下层的文字会"透光"，看起来更有层次 */
  background: var(--nav-bg-glass, var(--nav-bg, #ffffff));
  backdrop-filter: saturate(180%) blur(10px);
  border-bottom: 1px solid var(--nav-border, #ebeef5);
  /* 吸顶：页面滚动时导航栏一直留在顶部 */
  position: sticky;
  top: 0;
  z-index: 100;
}
.brand {
  font-size: 16px;
  font-weight: 600;
  color: var(--nav-text, #303133);
  text-decoration: none;
}
.links {
  display: flex;
  gap: 18px;
  margin-left: 6px;
}
.link {
  font-size: 14px;
  color: var(--nav-text-muted, #606266);
  text-decoration: none;
}
/* 用 exact-active：避免「首页」在文章详情页也被高亮 */
.link.router-link-exact-active {
  color: var(--nav-accent, #409eff);
  font-weight: 500;
}
.right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.who {
  font-size: 13px;
  color: var(--nav-text-muted, #909399);
}
.btn {
  font-size: 13px;
  padding: 5px 14px;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  border: 1px solid transparent;
  line-height: 1.5;
}
.btn.solid {
  background: var(--nav-accent, #409eff);
  color: #fff;
}
.btn.ghost {
  background: transparent;
  border-color: var(--nav-border, #dcdfe6);
  color: var(--nav-text-muted, #606266);
}
.btn.ghost:hover {
  border-color: var(--nav-accent, #409eff);
  color: var(--nav-accent, #409eff);
}
.main {
  /* 减去导航栏高度，保证内容区至少铺满一屏 */
  min-height: calc(100vh - var(--nav-height, 60px));
}

/* ---- 回到顶部 ---- */
.to-top {
  position: fixed;
  right: 24px;
  bottom: 28px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: var(--nav-text-muted, #606266);
  background: var(--nav-bg-glass, #ffffff);
  border: 1px solid var(--nav-border, #ebeef5);
  box-shadow: var(--card-shadow-hover, 0 10px 26px rgba(0, 0, 0, 0.1));
  backdrop-filter: saturate(180%) blur(10px);
  transition: transform 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  z-index: 150;
}
.to-top:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: translateY(-3px);
}
/* 淡入淡出（配合 <transition name="fade">） */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ---- 手机端：按钮缩小、左右留白收窄 ---- */
@media (max-width: 640px) {
  .navbar {
    padding: 0 14px;
    gap: 12px;
  }
  .brand {
    font-size: 15px;
  }
  .links {
    gap: 12px;
  }
  .who {
    display: none; /* 手机上空间紧张，昵称先藏起来 */
  }
  .btn {
    padding: 5px 10px;
  }
  .to-top {
    right: 14px;
    bottom: 18px;
    width: 38px;
    height: 38px;
  }
}
</style>
