<template>
  <div class="login-wrap">
    <div class="box">
      <h2>后台登录</h2>

      <el-form @submit.prevent="handleLogin">
        <el-form-item>
          <el-input v-model="username" placeholder="用户名" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="password"
            type="password"
            placeholder="密码"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          style="width: 100%"
          :loading="loading"
          @click="handleLogin"
        >
          登录
        </el-button>
      </el-form>

      <p class="tip">仅站长可登录（后台管理用）</p>
      <p class="back"><router-link to="/">← 返回首页</router-link></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus'; // ⚠️ 函数式组件要手动 import
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

// ⚠️ 安全：账号密码不能预填在代码里（仓库是公开的，预填 = 门锁上插着钥匙）
const username = ref('');
const password = ref('');
const loading = ref(false);

async function handleLogin() {
  if (!username.value || !password.value) {
    ElMessage.warning('请填写用户名和密码');
    return;
  }

  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    ElMessage.success('登录成功');
    router.push('/admin'); // 登录成功跳后台
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrap {
  /* 减去导航栏高度，否则页面会多出一条滚动条 */
  min-height: calc(100vh - 56px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-subtle);
  font-family: system-ui, sans-serif;
}
.box {
  width: 340px;
  padding: 32px;
  background: var(--bg-card);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.box h2 {
  margin: 0 0 24px;
  text-align: center;
  font-size: 20px;
}
.tip {
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
  margin: 16px 0 0;
}
.back {
  text-align: center;
  margin: 8px 0 0;
  font-size: 13px;
}
.back a {
  color: var(--accent);
}
</style>