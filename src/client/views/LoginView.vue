<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="login-logo">📝</div>
          <h1 class="login-title">Simple Notes</h1>
          <p class="login-subtitle">简洁优雅的个人记事应用</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input
              v-model="username"
              class="form-input"
              type="text"
              placeholder="请输入用户名"
              autocomplete="username"
              autofocus
            />
          </div>

          <div class="form-group">
            <label class="form-label">密码</label>
            <input
              v-model="password"
              class="form-input"
              type="password"
              placeholder="请输入密码"
              autocomplete="current-password"
            />
          </div>

          <div class="form-group remember-group">
            <label class="checkbox-label">
              <input v-model="rememberMe" type="checkbox" />
              <span>记住我</span>
            </label>
          </div>

          <button type="submit" class="btn btn-primary login-btn" :disabled="loading">
            {{ loading ? '登录中...' : '登 录' }}
          </button>

          <p v-if="error" class="login-error">{{ error }}</p>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';

const router = useRouter();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const showToast = inject<(msg: string, type: string) => void>('showToast')!;

const username = ref('');
const password = ref('');
const rememberMe = ref(false);
const loading = ref(false);
const error = ref('');

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    await authStore.login(username.value, password.value, rememberMe.value);
    await settingsStore.fetchSettings();
    router.push('/');
  } catch (e: any) {
    error.value = e.response?.data?.error || '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: var(--spacing-md);
}

.login-container {
  width: 100%;
  max-width: 420px;
}

.login-card {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-2xl);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.5s ease;
}

.login-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.login-logo {
  font-size: 48px;
  margin-bottom: var(--spacing-sm);
}

.login-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-accent), #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-top: var(--spacing-xs);
}

.login-form {
  display: flex;
  flex-direction: column;
}

.remember-group {
  margin-bottom: var(--spacing-lg);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
}

.login-btn {
  width: 100%;
  padding: 14px;
  font-size: var(--font-size-md);
  font-weight: 600;
}

.login-error {
  color: var(--color-danger);
  text-align: center;
  font-size: var(--font-size-sm);
  margin-top: var(--spacing-md);
}
</style>
