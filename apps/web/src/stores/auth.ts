import { defineStore } from 'pinia';
import { ref } from 'vue';
import request from '@/api/request';

interface User {
  id: number;
  email: string;
  username: string;
  nickname: string | null;
  role: string;
}

/**
 * 登录态管理
 *
 * 关键设计：access token 只存在内存里（不进 localStorage）
 * 原因：localStorage 能被 JS 读取，一旦 XSS 就泄漏。
 * 放内存里刷新页面就没了，靠 refresh token（httpOnly Cookie）恢复。
 * 这是答辩时能讲的安全细节。
 */
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null);
  const user = ref<User | null>(null);

  /** 是否已登录 */
  const isLoggedIn = () => !!accessToken.value;

  /** 登录 */
  async function login(username: string, password: string) {
    const res = (await request.post('/auth/login', { username, password })) as unknown as {
      success: boolean;
      data: { accessToken: string; expiresIn: number; user: User };
    };

    accessToken.value = res.data.accessToken;
    user.value = res.data.user;
    return res.data.user;
  }

  /**
   * 刷新 token
   * refresh token 在 httpOnly Cookie 里，浏览器自动带上，
   * 所以这里不需要传任何参数 —— 只靠 withCredentials: true
   */
  async function refresh() {
    const res = (await request.post('/auth/refresh')) as unknown as {
      success: boolean;
      data: { accessToken: string; user: User };
    };
    accessToken.value = res.data.accessToken;
    user.value = res.data.user;
  }

  /** 登出 */
  async function logout() {
    try {
      await request.post('/auth/logout');
    } catch {
      // 忽略错误：即使接口失败，本地状态也要清掉
    }
    accessToken.value = null;
    user.value = null;
  }

  return { accessToken, user, isLoggedIn, login, refresh, logout };
});