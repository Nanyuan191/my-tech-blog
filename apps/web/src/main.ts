
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
// 深色模式：Element Plus 官方深色变量表，只有在 <html class="dark"> 时才生效
import 'element-plus/theme-chalk/dark/css-vars.css';
// 我们自己的主题变量表（放在 Element Plus 样式之后，才能覆盖它的默认值）
import './styles/theme.css';
import 'highlight.js/styles/github-dark.css';

import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(createPinia()); // 状态管理（第4段登录会用到）
app.use(router);        // 路由
app.use(ElementPlus);   // UI 组件库
app.mount('#app');