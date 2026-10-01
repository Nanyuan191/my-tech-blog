import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite 配置
 * ------------------------------------------------------------
 * 三个关键点：
 *
 * 1. server.proxy —— 开发时把 /api 转发到后端
 *    这样前端代码里写 axios.get('/api/posts') 就行，
 *    不用硬编码 http://localhost:3000，也不用配 CORS。
 *    生产环境由 Nginx 做同样的事，前后端代码都不用改。
 *
 * 2. AutoImport + Components —— Element Plus 按需自动引入
 *    不配置的话，每次用 ElButton 都要手写 import，很啰嗦。
 *    配了之后直接写 <el-button> 就能用，且只打包用到的组件
 *    （全量引入 Element Plus 会让产物多出 1MB 左右）。
 *
 * 3. resolve.alias 的 '@' —— 用 @/views/Home.vue 代替 ../../views/Home.vue
 *    避免层层相对路径，移动文件时也不用改 import。
 */
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts',
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    host: true,
    proxy: {
      // 开发时后端跑在 3000，前端 5173，通过代理消除跨域
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    // 手动分包：把体积大的第三方库单独拆出来，
    // 这样业务代码改动时，用户浏览器里的 vue/element 缓存依然有效
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          element: ['element-plus'],
          markdown: ['markdown-it', 'highlight.js', 'dompurify'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
