<template>
  <div class="pwd-wrap">
    <div class="box">
      <h2>修改密码</h2>

      <el-form @submit.prevent="handleSubmit">
        <el-form-item>
          <el-input
            v-model="oldPassword"
            type="password"
            placeholder="当前密码"
            size="large"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="newPassword"
            type="password"
            placeholder="新密码（至少 6 位）"
            size="large"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="confirmPassword"
            type="password"
            placeholder="再输一遍新密码"
            size="large"
            show-password
            @keyup.enter="handleSubmit"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          style="width: 100%"
          :loading="loading"
          @click="handleSubmit"
        >
          确认修改
        </el-button>
      </el-form>

      <p class="tip">修改成功后需要用新密码重新登录</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus'; // ⚠️ 函数式组件要手动 import
import request from '@/api/request';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);

/**
 * 前端校验只做「体验层」：少跑一次无效请求、提示更快。
 * 真正的规则校验在后端 Zod（newPassword 6~128 位），两边规则保持一致。
 * 这就是「前端校验防手滑，后端校验防攻击」——答辩可以讲这个分层。
 */
function validate(): string {
  if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
    return '请填写完整';
  }
  if (newPassword.value.length < 6 || newPassword.value.length > 128) {
    return '新密码需要 6~128 位（与后端规则一致）';
  }
  if (newPassword.value !== confirmPassword.value) {
    return '两次输入的新密码不一致';
  }
  if (newPassword.value === oldPassword.value) {
    return '新密码不能和当前密码相同';
  }
  return '';
}

async function handleSubmit() {
  const msg = validate();
  if (msg) {
    ElMessage.warning(msg);
    return;
  }

  loading.value = true;
  try {
    // ⚠️ 改密码是需要登录的接口，手动带 access token（和后台写文章同一套路）
    await request.put(
      '/auth/password',
      { oldPassword: oldPassword.value, newPassword: newPassword.value },
      { headers: { Authorization: `Bearer ${auth.accessToken}` } },
    );

    ElMessage.success('密码修改成功，请用新密码重新登录');
    // 改完密码强制登出：把后端 Cookie 也清掉，再跳登录页
    await auth.logout();
    router.push('/login');
  } catch (e) {
    // 后端会返回「当前密码错误」这类信息，直接展示给用户
    ElMessage.error(e instanceof Error ? e.message : '修改失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.pwd-wrap {
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
</style>
