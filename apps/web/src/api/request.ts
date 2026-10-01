import axios from 'axios';

// axios 实例：统一配置所有请求
const request = axios.create({
  // ⚠️ 只写 /api，不要写 http://localhost:3000/api
  // 开发时 Vite 代理转发，生产时 Nginx 转发，这份代码两处通用
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true, // 带上 Cookie（refresh token 存在里面）
});

// 响应拦截器：统一剥掉外层包装
request.interceptors.response.use(
  (response) => response.data, // 后端返回 {success, data}，这里直接给 data
  // ⚠️ 这里必须手写 error 的类型，因为 tsconfig 开了 strict
  (error: { response?: { data?: { message?: string } }; message?: string }) => {
    const message = error.response?.data?.message || error.message || '请求失败';
    console.error('[请求失败]', message);
    return Promise.reject(new Error(message));
  },
);

export default request;