<template>
  <div class="manage-view">
    <div class="page-header">
      <h1 class="page-title">笔记本与分类管理</h1>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" @click="openNewCategory">
          <Plus :size="17" aria-hidden="true" />
          新建分类
        </button>
        <button class="btn btn-primary btn-sm" @click="openNewNotebook">
          <Plus :size="17" aria-hidden="true" />
          新建笔记本
        </button>
      </div>
    </div>

    <section v-if="homeCategory" class="home-category card">
      <div class="item-info">
        <Home :size="18" aria-hidden="true" />
        <div>
          <div class="item-name">首页 - {{ homeCategory.name }}</div>
          <div class="item-count">{{ homeCategory.noteCount }} 篇笔记 · 不属于任何笔记本</div>
        </div>
      </div>
      <span class="item-badge">系统默认</span>
    </section>

    <div class="notebook-list">
      <section v-for="notebook in notesStore.notebooks" :key="notebook.id" class="notebook-card card">
        <div class="notebook-header">
          <div class="item-info">
            <Folder :size="18" aria-hidden="true" />
            <span class="item-name">{{ notebook.name }}</span>
            <span v-if="notebook.isDefault" class="item-badge">默认笔记本</span>
          </div>
          <div class="item-actions">
            <button class="btn btn-ghost btn-sm" @click="openEditNotebook(notebook)">
              <Pencil :size="16" aria-hidden="true" />
              重命名
            </button>
            <button
              class="btn btn-ghost btn-sm"
              @click="deleteNotebook(notebook)"
              :disabled="notebook.isDefault || categoriesForNotebook(notebook.id).length > 0"
              :title="notebookDeleteTitle(notebook)"
            >
              <Trash2 :size="16" aria-hidden="true" />
              删除
            </button>
          </div>
        </div>

        <div v-if="categoriesForNotebook(notebook.id).length" class="category-list">
          <div v-for="category in categoriesForNotebook(notebook.id)" :key="category.id" class="category-row">
            <div class="item-info">
              <span class="item-name">{{ category.name }}</span>
              <span class="item-count">{{ category.noteCount }} 篇笔记</span>
            </div>
            <div class="item-actions">
              <button class="btn btn-ghost btn-sm" @click="openEditCategory(category)">
                <Pencil :size="16" aria-hidden="true" />
                编辑
              </button>
              <button
                class="btn btn-ghost btn-sm"
                @click="deleteCategory(category)"
                :disabled="category.totalNoteCount > 0"
                :title="category.totalNoteCount > 0 ? '有笔记（包含回收站）时不可删除' : '删除'"
              >
                <Trash2 :size="16" aria-hidden="true" />
                删除
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-categories">暂无分类</div>
      </section>
    </div>

    <div v-if="modalMode" class="modal-overlay" @click.self="closeModal">
      <div ref="dialogRef" class="modal-content" role="dialog" aria-modal="true" aria-labelledby="manage-dialog-title" tabindex="-1">
        <div class="modal-header">
          <h2 id="manage-dialog-title" class="modal-title">{{ modalTitle }}</h2>
          <button class="btn btn-ghost btn-icon" @click="closeModal" aria-label="关闭">
            <X :size="18" aria-hidden="true" />
          </button>
        </div>
        <div class="form-group">
          <label class="form-label" for="item-name">{{ modalMode === 'notebook' ? '笔记本名称' : '分类名称' }}</label>
          <input id="item-name" v-model="itemName" class="form-input" :placeholder="modalMode === 'notebook' ? '输入笔记本名称' : '输入分类名称'" @keydown.enter="submitItem" data-autofocus />
        </div>
        <div v-if="modalMode === 'category'" class="form-group">
          <label class="form-label" for="category-notebook">所属笔记本</label>
          <select id="category-notebook" v-model="selectedNotebookId" class="form-input">
            <option v-for="notebook in notesStore.notebooks" :key="notebook.id" :value="notebook.id">
              {{ notebook.name }}
            </option>
          </select>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="submitItem" :disabled="submitting || !canSubmit">
            {{ submitting ? '处理中...' : '确定' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, inject, onMounted } from 'vue';
import { Folder, Home, Pencil, Plus, Trash2, X } from '@lucide/vue';
import { useNotesStore, type Category, type Notebook } from '@/stores/notes';
import { useModalFocus } from '@/composables/useModalFocus';

const notesStore = useNotesStore();
const showToast = inject<(msg: string, type: string) => void>('showToast')!;

const modalMode = ref<'notebook' | 'category' | null>(null);
const editingNotebook = ref<Notebook | null>(null);
const editingCategory = ref<Category | null>(null);
const itemName = ref('');
const selectedNotebookId = ref('');
const submitting = ref(false);
const modalOpen = computed(() => modalMode.value !== null);
const homeCategory = computed(() => notesStore.categories.find(category => category.isDefault));
const modalTitle = computed(() => {
  if (modalMode.value === 'notebook') return editingNotebook.value ? '重命名笔记本' : '新建笔记本';
  return editingCategory.value ? '编辑分类' : '新建分类';
});
const canSubmit = computed(() => (
  !!itemName.value.trim()
  && (modalMode.value !== 'category' || !!selectedNotebookId.value)
));

function categoriesForNotebook(notebookId: string) {
  return notesStore.categories.filter(category => category.notebookId === notebookId);
}

function openNewNotebook() {
  modalMode.value = 'notebook';
  editingNotebook.value = null;
  itemName.value = '';
}

function openEditNotebook(notebook: Notebook) {
  modalMode.value = 'notebook';
  editingNotebook.value = notebook;
  itemName.value = notebook.name;
}

function openNewCategory() {
  modalMode.value = 'category';
  editingCategory.value = null;
  itemName.value = '';
  selectedNotebookId.value = notesStore.notebooks.find(notebook => notebook.isDefault)?.id
    || notesStore.notebooks[0]?.id
    || '';
}

function openEditCategory(category: Category) {
  modalMode.value = 'category';
  editingCategory.value = category;
  itemName.value = category.name;
  selectedNotebookId.value = category.notebookId || '';
}

function closeModal() {
  modalMode.value = null;
  editingNotebook.value = null;
  editingCategory.value = null;
  itemName.value = '';
  selectedNotebookId.value = '';
}

const { dialogRef } = useModalFocus(modalOpen, closeModal);

async function refreshStructure() {
  await Promise.all([notesStore.fetchNotebooks(), notesStore.fetchCategories()]);
}

async function submitItem() {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    const name = itemName.value.trim();
    if (modalMode.value === 'notebook') {
      if (editingNotebook.value) {
        await notesStore.updateNotebook(editingNotebook.value.id, name);
        showToast('笔记本已更新', 'success');
      } else {
        await notesStore.createNotebook(name);
        showToast('笔记本已创建', 'success');
      }
    } else if (editingCategory.value) {
      await notesStore.updateCategory(editingCategory.value.id, {
        name,
        notebookId: selectedNotebookId.value,
      });
      showToast('分类已更新', 'success');
    } else {
      await notesStore.createCategory(name, selectedNotebookId.value);
      showToast('分类已创建', 'success');
    }
    closeModal();
    await refreshStructure();
  } catch (e: any) {
    showToast(e.response?.data?.error || '操作失败', 'error');
  } finally {
    submitting.value = false;
  }
}

function notebookDeleteTitle(notebook: Notebook) {
  if (notebook.isDefault) return '默认笔记本不能删除';
  return categoriesForNotebook(notebook.id).length > 0 ? '笔记本下还有分类' : '删除';
}

async function deleteNotebook(notebook: Notebook) {
  if (notebook.isDefault || categoriesForNotebook(notebook.id).length > 0) return;
  if (!confirm(`确定删除笔记本“${notebook.name}”？`)) return;
  try {
    await notesStore.deleteNotebook(notebook.id);
    showToast('笔记本已删除', 'success');
  } catch (e: any) {
    showToast(e.response?.data?.error || '删除失败', 'error');
  }
}

async function deleteCategory(category: Category) {
  if (category.totalNoteCount > 0) {
    showToast('该分类下还有笔记（包含回收站），不能删除', 'error');
    return;
  }
  if (!confirm(`确定删除分类“${category.name}”？`)) return;
  try {
    await notesStore.deleteCategory(category.id);
    showToast('分类已删除', 'success');
  } catch (e: any) {
    showToast(e.response?.data?.error || '删除失败', 'error');
  }
}

onMounted(refreshStructure);
</script>

<style scoped>
.page-actions,
.item-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.home-category,
.notebook-card {
  padding: var(--spacing-md) var(--spacing-lg);
}

.home-category,
.notebook-header,
.category-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.notebook-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
}

.notebook-header {
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-light);
}

.category-list {
  display: flex;
  flex-direction: column;
}

.category-row {
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.category-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.item-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
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
  white-space: nowrap;
}

.item-count,
.empty-categories {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.empty-categories {
  padding-top: var(--spacing-md);
}

.form-group + .form-group {
  margin-top: var(--spacing-md);
}

@media (max-width: 768px) {
  .page-actions {
    width: 100%;
  }

  .page-actions .btn {
    flex: 1;
  }

  .home-category,
  .notebook-header,
  .category-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .item-actions {
    width: 100%;
  }
}
</style>
