<template>
  <div class="manage-view">
    <div class="page-header">
      <h1 class="page-title">标签管理</h1>
      <button class="btn btn-primary btn-sm" @click="showAddModal = true">+ 新建标签</button>
    </div>

    <div v-if="notesStore.tags.length === 0" class="empty-state">
      <div class="empty-state-icon">🏷️</div>
      <p class="empty-state-text">还没有标签</p>
    </div>

    <div v-else class="items-list">
      <div v-for="tag in notesStore.tags" :key="tag.id" class="item-row card">
        <div class="item-info">
          <span class="item-name"># {{ tag.name }}</span>
          <span class="item-count">{{ tag.noteCount }} 篇笔记</span>
        </div>
        <div class="item-actions">
          <button class="btn btn-ghost btn-sm" @click="startEdit(tag)">✏️ 编辑</button>
          <button class="btn btn-ghost btn-sm" @click="deleteItem(tag)">🗑️ 删除</button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal || editingItem" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">{{ editingItem ? '编辑标签' : '新建标签' }}</h2>
          <button class="btn btn-ghost btn-icon" @click="closeModal">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">标签名称</label>
          <input v-model="itemName" class="form-input" placeholder="输入标签名称" @keydown.enter="submitItem" autofocus />
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="submitItem" :disabled="!itemName.trim()">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted } from 'vue';
import { useNotesStore, type Tag } from '@/stores/notes';

const notesStore = useNotesStore();
const showToast = inject<(msg: string, type: string) => void>('showToast')!;

const showAddModal = ref(false);
const editingItem = ref<Tag | null>(null);
const itemName = ref('');

function startEdit(tag: Tag) {
  editingItem.value = tag;
  itemName.value = tag.name;
}

function closeModal() {
  showAddModal.value = false;
  editingItem.value = null;
  itemName.value = '';
}

async function submitItem() {
  if (!itemName.value.trim()) return;

  try {
    if (editingItem.value) {
      await notesStore.updateTag(editingItem.value.id, itemName.value.trim());
      showToast('标签已更新', 'success');
    } else {
      await notesStore.createTag(itemName.value.trim());
      showToast('标签已创建', 'success');
    }
    closeModal();
    await notesStore.fetchTags();
  } catch (e: any) {
    showToast(e.response?.data?.error || '操作失败', 'error');
  }
}

async function deleteItem(tag: Tag) {
  if (!confirm(`确定删除标签"${tag.name}"？已关联的笔记不会受影响。`)) return;

  try {
    await notesStore.deleteTag(tag.id);
    showToast('标签已删除', 'success');
  } catch (e: any) {
    showToast(e.response?.data?.error || '删除失败', 'error');
  }
}

onMounted(() => notesStore.fetchTags());
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

.item-name {
  font-weight: 500;
}

.item-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.item-actions {
  display: flex;
  gap: var(--spacing-xs);
}
</style>
