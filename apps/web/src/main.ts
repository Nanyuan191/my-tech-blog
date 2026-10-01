
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'highlight.js/styles/github-dark.css';

import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(createPinia()); // 状态管理（第4段登录会用到）
app.use(router);        // 路由
app.use(ElementPlus);   // UI 组件库
app.mount('#app');