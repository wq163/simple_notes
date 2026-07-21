<template>
  <div class="admin-view">
    <div class="page-header">
      <h1 class="page-title">用户管理</h1>
      <button class="btn btn-primary btn-sm" @click="showAddModal = true">
        <UserPlus :size="17" aria-hidden="true" />
        创建用户
      </button>
    </div>

    <div class="items-list">
      <div v-for="user in users" :key="user.id" class="item-row card">
        <div class="item-info">
          <div class="user-avatar-sm">{{ user.displayName?.charAt(0) || '?' }}</div>
          <div>
            <span class="item-name">{{ user.displayName }}</span>
            <span class="item-username">@{{ user.username }}</span>
          </div>
          <span v-if="user.role === 'admin'" class="item-badge">管理员</span>
        </div>
        <div class="item-actions">
          <button v-if="user.role !== 'admin'" class="btn btn-ghost btn-sm" @click="deleteUser(user)">
            <Trash2 :size="16" aria-hidden="true" />
            删除
          </button>
        </div>
      </div>
    </div>

    <!-- Create User Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
      <div ref="dialogRef" class="modal-content" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" tabindex="-1">
        <div class="modal-header">
          <h2 id="user-dialog-title" class="modal-title">创建用户</h2>
          <button class="btn btn-ghost btn-icon" @click="closeModal" aria-label="关闭">
            <X :size="18" aria-hidden="true" />
          </button>
        </div>

        <div class="form-group">
          <label class="form-label" for="new-username">用户名</label>
          <input id="new-username" v-model="newUser.username" class="form-input" placeholder="用户名" data-autofocus />
        </div>

        <div class="form-group">
          <label class="form-label" for="new-password">密码</label>
          <input id="new-password" v-model="newUser.password" class="form-input" type="password" placeholder="密码（至少4个字符）" />
        </div>

        <div class="form-group">
          <label class="form-label" for="new-display-name">显示名称（可选）</label>
          <input id="new-display-name" v-model="newUser.displayName" class="form-input" placeholder="显示名称" />
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="createUser" :disabled="!newUser.username || !newUser.password">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, inject } from 'vue';
import { Trash2, UserPlus, X } from '@lucide/vue';
import api from '@/api';
import { useModalFocus } from '@/composables/useModalFocus';

const showToast = inject<(msg: string, type: string) => void>('showToast')!;

interface UserItem {
  id: string;
  username: string;
  displayName: string;
  role: string;
  createdAt: string;
}

const users = ref<UserItem[]>([]);
const showAddModal = ref(false);
const newUser = reactive({ username: '', password: '', displayName: '' });

function closeModal() {
  showAddModal.value = false;
}

const { dialogRef } = useModalFocus(showAddModal, closeModal);

async function fetchUsers() {
  try {
    const { data } = await api.get('/admin/users');
    users.value = data;
  } catch {
    showToast('获取用户列表失败', 'error');
  }
}

async function createUser() {
  try {
    await api.post('/admin/users', {
      username: newUser.username,
      password: newUser.password,
      displayName: newUser.displayName || newUser.username,
    });
    showToast('用户已创建', 'success');
    closeModal();
    newUser.username = '';
    newUser.password = '';
    newUser.displayName = '';
    await fetchUsers();
  } catch (e: any) {
    showToast(e.response?.data?.error || '创建失败', 'error');
  }
}

async function deleteUser(user: UserItem) {
  if (!confirm(`确定删除用户"${user.username}"？该操作不可恢复！`)) return;

  try {
    await api.delete(`/admin/users/${user.id}`);
    showToast('用户已删除', 'success');
    await fetchUsers();
  } catch (e: any) {
    showToast(e.response?.data?.error || '删除失败', 'error');
  }
}

onMounted(fetchUsers);
</script>

<style scoped>
.items-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
}

.item-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.user-avatar-sm {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--color-accent-gradient);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: var(--font-size-xs);
}

.item-name {
  font-weight: 500;
}

.item-username {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-left: var(--spacing-xs);
}

.item-badge {
  font-size: var(--font-size-xs);
  background: var(--color-accent-light);
  color: var(--color-accent);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.item-actions {
  display: flex;
  gap: var(--spacing-xs);
}
</style>
