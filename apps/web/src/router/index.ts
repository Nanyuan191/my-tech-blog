import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      // 特殊页：网站说明 + 博主的话（静态内容，不进数据库）
      path: '/notes',
      name: 'notes',
      component: () => import('@/views/NotesView.vue'),
    },
    {
      path: '/posts/:slug',
      name: 'post',
      component: () => import('@/views/PostView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('@/views/ChangePasswordView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      // meta 是自定义字段，路由守卫会读它
      meta: { requiresAuth: true },
    },
  ],
});

/**
 * 路由守卫：进入需要登录的页面前检查登录态
 *
 * 注意：这只是「前端体验层面」的保护，
 * 真正的安全靠后端接口的 401 拦截 —— 前端守卫只是防止用户看到空白页，
 * 不是安全机制。答辩时这一点要讲清楚，不然会被问住。
 */
router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.requiresAuth && !auth.isLoggedIn()) {
    // 没登录就跳登录页，并记住原本要去哪
    return { path: '/login', query: { redirect: to.fullPath } };
  }
});

export default router;