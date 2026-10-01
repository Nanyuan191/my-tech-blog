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

      <p class="tip">默认账号：admin / admin123456</p>
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

const username = ref('admin');
const password = ref('admin123456');
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
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  font-family: system-ui, sans-serif;
}
.box {
  width: 340px;
  padding: 32px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.box h2 {
  margin: 0 0 24px;
  text-align: center;
  font-size: 20px;
}
.tip {
  color: #999;
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
  color: #409eff;
}
</style>