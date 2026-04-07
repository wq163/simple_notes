<template>
  <div class="manage-view">
    <div class="page-header">
      <h1 class="page-title">分类管理</h1>
      <button class="btn btn-primary btn-sm" @click="showAddModal = true">+ 新建分类</button>
    </div>

    <div class="items-list">
      <div
        v-for="cat in notesStore.categories"
        :key="cat.id"
        class="item-row card"
      >
        <div class="item-info">
          <span class="item-name">{{ cat.name }}</span>
          <!-- <span v-if="cat.isDefault" class="item-badge">默认</span> -->
          <span class="item-count">{{ cat.noteCount }} 篇笔记</span>
        </div>
        <div v-if="!cat.isDefault" class="item-actions">
          <button class="btn btn-ghost btn-sm" @click="startEdit(cat)">✏️ 编辑</button>
          <button class="btn btn-ghost btn-sm" @click="deleteItem(cat)" :disabled="cat.noteCount > 0" :title="cat.noteCount > 0 ? '有笔记时不可删除' : '删除'">🗑️ 删除</button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal || editingItem" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">{{ editingItem ? '编辑分类' : '新建分类' }}</h2>
          <button class="btn btn-ghost btn-icon" @click="closeModal">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">分类名称</label>
          <input v-model="itemName" class="form-input" placeholder="输入分类名称" @keydown.enter="submitItem" autofocus />
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
import { useNotesStore, type Category } from '@/stores/notes';

const notesStore = useNotesStore();
const showToast = inject<(msg: string, type: string) => void>('showToast')!;

const showAddModal = ref(false);
const editingItem = ref<Category | null>(null);
const itemName = ref('');

function startEdit(cat: Category) {
  editingItem.value = cat;
  itemName.value = cat.name;
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
      await notesStore.updateCategory(editingItem.value.id, itemName.value.trim());
      showToast('分类已更新', 'success');
    } else {
      await notesStore.createCategory(itemName.value.trim());
      showToast('分类已创建', 'success');
    }
    closeModal();
    await notesStore.fetchCategories();
  } catch (e: any) {
    showToast(e.response?.data?.error || '操作失败', 'error');
  }
}

async function deleteItem(cat: Category) {
  if (cat.noteCount > 0) {
    showToast('该分类下还有笔记，不能删除', 'error');
    return;
  }
  if (!confirm(`确定删除分类"${cat.name}"？`)) return;

  try {
    await notesStore.deleteCategory(cat.id);
    showToast('分类已删除', 'success');
  } catch (e: any) {
    showToast(e.response?.data?.error || '删除失败', 'error');
  }
}

onMounted(() => notesStore.fetchCategories());
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

.item-badge {
  font-size: var(--font-size-xs);
  background: var(--color-accent-light);
  color: var(--color-accent);
  padding: 2px 8px;
  border-radius: var(--radius-full);
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
