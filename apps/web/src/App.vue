<template>
  <div class="app">
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
  </div>
</template>

<script setup lang="ts">
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
</script>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 56px;
  padding: 0 24px;
  background: var(--nav-bg, #ffffff);
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
  min-height: calc(100vh - 56px);
}
</style>
