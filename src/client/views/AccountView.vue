<template>
  <div class="account-view">
    <div class="page-header">
      <h1 class="page-title">账号管理</h1>
    </div>

    <div class="account-sections">
      <!-- Profile -->
      <div class="settings-card card">
        <h3 class="settings-section-title">个人信息</h3>

        <div class="form-group">
          <label class="form-label">用户名</label>
          <input class="form-input" :value="authStore.user?.username" disabled />
        </div>

        <div class="form-group">
          <label class="form-label">显示名称</label>
          <input v-model="displayName" class="form-input" placeholder="输入显示名称" />
        </div>

        <button class="btn btn-primary" @click="updateProfile" :disabled="!displayName.trim()">
          保存
        </button>
      </div>

      <!-- Change Password -->
      <div class="settings-card card">
        <h3 class="settings-section-title">修改密码</h3>

        <div class="form-group">
          <label class="form-label">旧密码</label>
          <input v-model="oldPassword" class="form-input" type="password" placeholder="输入旧密码" />
        </div>

        <div class="form-group">
          <label class="form-label">新密码</label>
          <input v-model="newPassword" class="form-input" type="password" placeholder="输入新密码（至少4个字符）" />
        </div>

        <div class="form-group">
          <label class="form-label">确认新密码</label>
          <input v-model="confirmPassword" class="form-input" type="password" placeholder="再次输入新密码" />
        </div>

        <button class="btn btn-primary" @click="changePassword">修改密码</button>
      </div>

      <!-- Logout -->
      <div class="settings-card card">
        <button class="btn btn-danger" @click="handleLogout">退出登录</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/api';

const router = useRouter();
const authStore = useAuthStore();
const showToast = inject<(msg: string, type: string) => void>('showToast')!;

const displayName = ref('');
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

async function updateProfile() {
  try {
    await api.put('/users/me', { displayName: displayName.value.trim() });
    await authStore.fetchProfile();
    showToast('已更新', 'success');
  } catch (e: any) {
    showToast(e.response?.data?.error || '更新失败', 'error');
  }
}

async function changePassword() {
  if (!oldPassword.value || !newPassword.value) {
    showToast('请填写所有密码字段', 'error');
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    showToast('两次输入的新密码不一致', 'error');
    return;
  }
  if (newPassword.value.length < 4) {
    showToast('新密码至少4个字符', 'error');
    return;
  }

  try {
    await api.put('/users/me/password', {
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    });
    showToast('密码已修改', 'success');
    oldPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (e: any) {
    showToast(e.response?.data?.error || '修改失败', 'error');
  }
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

onMounted(() => {
  displayName.value = authStore.user?.displayName || '';
});
</script>

<style scoped>
.account-sections {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 640px;
}

.settings-card {
  padding: var(--spacing-lg);
}

.settings-section-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-light);
}
</style>
