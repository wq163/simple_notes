<template>
  <div class="editor-view">
    <div class="editor-header">
      <button class="btn btn-ghost back-btn" @click="goBack">
        <ArrowLeft :size="18" aria-hidden="true" />
        返回
      </button>
      <div class="editor-meta">
        <select v-model="selectedCategory" class="form-input category-select" aria-label="笔记分类">
          <option v-for="cat in notesStore.categories" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>
        <span class="title-rule">首个非空行作为标题</span>
      </div>
      <div class="editor-actions">
        <span class="save-status" :class="`save-status-${saveStatus}`" aria-live="polite">
          <LoaderCircle v-if="saveStatus === 'saving'" :size="15" class="status-spinner" aria-hidden="true" />
          <CheckCircle2 v-else-if="saveStatus === 'saved'" :size="15" aria-hidden="true" />
          <AlertCircle v-else-if="saveStatus === 'error'" :size="15" aria-hidden="true" />
          {{ saveStatusText }}
        </span>
        <button class="btn btn-primary" @click="saveNote">
          <Save :size="17" aria-hidden="true" />
          保存
        </button>
      </div>
    </div>


    <!-- Milkdown Editor Area -->
    <div class="editor-body" v-if="editorReady">
      <MilkdownWrapper
        ref="editorRef"
        :default-value="initialContent"
        :on-change="handleContentChange"
        :image-upload="handleImageUpload"
        :file-upload="handleFileUpload"
      />
    </div>
    <div v-else class="loading-spinner">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, inject, computed, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import { AlertCircle, ArrowLeft, CheckCircle2, LoaderCircle, Save } from '@lucide/vue';
import { useNotesStore } from '@/stores/notes';
import MilkdownWrapper from '@/components/MilkdownWrapper.vue';
import api from '@/api';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();
const showToast = inject<(msg: string, type: string) => void>('showToast')!;

const initialContent = ref('');
const currentContent = ref('');
const selectedCategory = ref('');
const selectedTags = ref<string[]>([]);
const saving = ref(false);
const editorReady = ref(false);
const contentChanged = ref(false);
const lastSavedContent = ref('');
const lastSavedCategory = ref('');
const lastSavedTags = ref<string[]>([]);
const lastSavedAt = ref<Date | null>(null);
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
const editorRef = ref<{ getMarkdown: () => string } | null>(null);

let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;
let activeSave: Promise<boolean> | null = null;
let flushPromise: Promise<boolean> | null = null;
let allowInternalNavigation = false;

const isEditing = computed(() => !!route.query.noteId);
const noteId = computed(() => route.query.noteId as string);
const isDirty = computed(() => (
  (contentChanged.value && currentContent.value !== lastSavedContent.value)
  || selectedCategory.value !== lastSavedCategory.value
  || selectedTags.value.join(',') !== lastSavedTags.value.join(',')
));
const saveStatusText = computed(() => {
  if (saveStatus.value === 'saving') return '保存中…';
  if (saveStatus.value === 'error') return '保存失败，请重试';
  if (saveStatus.value === 'saved' && lastSavedAt.value) {
    return `已保存 ${lastSavedAt.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return isDirty.value ? '未保存' : '已保存';
});

// Ctrl+S / Cmd+S 快捷键保存
function handleKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    void saveNote();
  }
}

async function goBack() {
  const newQuery = { ...route.query };
  delete newQuery.noteId;
  delete newQuery.newNote;
  await router.push({ path: route.path, query: newQuery });
}

function handleContentChange(markdown: string) {
  currentContent.value = markdown;
  contentChanged.value = true;
}

async function handleImageUpload(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('files', file);

  try {
    const { data } = await api.post('/attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (data && data.length > 0) {
      return data[0].url;
    }
    throw new Error('上传失败');
  } catch (e: any) {
    showToast(e.response?.data?.error || '图片上传失败', 'error');
    throw e;
  }
}

async function handleFileUpload(file: File): Promise<{ url: string; originalName: string; isImage: boolean }> {
  const formData = new FormData();
  formData.append('files', file);

  try {
    const { data } = await api.post('/attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (data && data.length > 0) {
      return {
        url: data[0].url,
        originalName: data[0].originalName,
        isImage: data[0].isImage,
      };
    }
    throw new Error('上传失败');
  } catch (e: any) {
    showToast(e.response?.data?.error || '文件上传失败', 'error');
    throw e;
  }
}

function clearAutoSaveTimer() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = undefined;
  }
}

function syncEditorContent() {
  if (editorRef.value) currentContent.value = editorRef.value.getMarkdown();
}

function scheduleAutoSave() {
  clearAutoSaveTimer();
  if (!editorReady.value || !isDirty.value) return;
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = undefined;
    void flushSave();
  }, 5000);
}

async function refreshCurrentList() {
  if (route.name === 'Category') {
    await notesStore.fetchNotes({ categoryId: route.params.id as string }, { silent: true });
  } else if (route.name === 'Tag') {
    await notesStore.fetchNotes({ tagId: route.params.id as string }, { silent: true });
  } else if (route.name === 'Search') {
    await notesStore.fetchNotes({ search: route.query.q as string }, { silent: true });
  } else {
    await notesStore.fetchNotes(undefined, { silent: true });
  }
}

async function persistSnapshot(): Promise<boolean> {
  const content = currentContent.value;
  const categoryId = selectedCategory.value;

  if (!isEditing.value && !content.trim()) {
    lastSavedCategory.value = categoryId;
    saveStatus.value = 'saved';
    return true;
  }

  saving.value = true;
  saveStatus.value = 'saving';
  try {
    // Auto-parse tags from content (matches #tagName or \#tagName, avoiding # heading space)
    const tagRegex = /(?:^|\s)\\?#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g;
    const matches = [...content.matchAll(tagRegex)];
    const tagNames = [...new Set(matches.map(m => m[1]))];
    
    selectedTags.value = [];
    for (const name of tagNames) {
      let tag = notesStore.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (!tag) {
        tag = await notesStore.createTag(name);
      }
      selectedTags.value.push(tag.id);
    }

    if (isEditing.value) {
      await notesStore.updateNote(noteId.value, {
        content,
        categoryId,
        tagIds: selectedTags.value,
      });
    } else {
      const id = await notesStore.createNote(content, categoryId, selectedTags.value);
      allowInternalNavigation = true;
      try {
        await router.replace({ path: route.path, query: { ...route.query, noteId: id, newNote: undefined } });
      } finally {
        allowInternalNavigation = false;
      }
    }

    lastSavedContent.value = content;
    lastSavedCategory.value = categoryId;
    lastSavedTags.value = [...selectedTags.value];
    lastSavedAt.value = new Date();
    saveStatus.value = isDirty.value ? 'idle' : 'saved';

    await notesStore.fetchTags();
    await refreshCurrentList();
    return true;
  } catch (e: any) {
    saveStatus.value = 'error';
    return false;
  } finally {
    saving.value = false;
  }
}

async function flushSave(showErrorFeedback = false): Promise<boolean> {
  syncEditorContent();
  clearAutoSaveTimer();

  if (!flushPromise) {
    flushPromise = (async () => {
      while (isDirty.value) {
        activeSave = persistSnapshot();
        const succeeded = await activeSave;
        activeSave = null;
        if (!succeeded) return false;
      }
      return true;
    })().finally(() => {
      flushPromise = null;
    });
  }

  const succeeded = await flushPromise;
  if (showErrorFeedback && !succeeded) {
    showToast('保存失败，已保留当前内容', 'error');
  }
  return succeeded;
}

async function saveNote() {
  await flushSave(true);
}

async function guardNavigation() {
  if (allowInternalNavigation) return true;
  if (!isDirty.value && !activeSave && !flushPromise) return true;
  return flushSave(true);
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  syncEditorContent();
  if (!isDirty.value && !activeSave && !flushPromise) return;
  event.preventDefault();
  event.returnValue = '';
}

onBeforeRouteUpdate(guardNavigation);
onBeforeRouteLeave(guardNavigation);

watch([currentContent, selectedCategory], () => {
  if (!editorReady.value) return;
  if (isDirty.value) {
    if (saveStatus.value !== 'error') saveStatus.value = 'idle';
    scheduleAutoSave();
  } else {
    clearAutoSaveTimer();
    saveStatus.value = 'saved';
  }
});

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('beforeunload', handleBeforeUnload);

  await notesStore.fetchCategories();
  await notesStore.fetchTags();

  // Set default category: 如果当前在某个分类页面，新建笔记默认使用该分类
  if (!isEditing.value && route.name === 'Category' && route.params.id) {
    selectedCategory.value = route.params.id as string;
  } else {
    const defaultCat = notesStore.categories.find(c => c.isDefault);
    if (defaultCat) selectedCategory.value = defaultCat.id;
  }

  // If editing, load note
  if (isEditing.value) {
    try {
      const note = await notesStore.getNote(noteId.value);
      initialContent.value = note.content;
      currentContent.value = note.content;
      selectedCategory.value = note.categoryId;
      selectedTags.value = note.tags.map(t => t.id);
    } catch {
      showToast('加载笔记失败', 'error');
      goBack();
      return;
    }
  }

  lastSavedContent.value = currentContent.value;
  lastSavedCategory.value = selectedCategory.value;
  lastSavedTags.value = [...selectedTags.value];
  lastSavedAt.value = null;
  saveStatus.value = 'saved';
  editorReady.value = true;
});

onBeforeUnmount(() => {
  clearAutoSaveTimer();
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('beforeunload', handleBeforeUnload);
});

defineExpose({ flushSave });
</script>

<style scoped>
.editor-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: calc(100vh - 120px);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.editor-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-light);
  flex-wrap: wrap;
}

.category-select {
  padding: 8px 12px;
  font-size: var(--font-size-sm);
  max-width: 200px;
}

.editor-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.editor-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: nowrap;
  flex-shrink: 0;
}

.title-rule {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.save-status {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.save-status-error {
  color: var(--color-danger);
}

.save-status-saved {
  color: var(--color-success);
}

.status-spinner {
  animation: spin 0.8s linear infinite;
}

@media (min-width: 769px) {
  .back-btn {
    display: none;
  }
}

.editor-body {
  flex: 1;
  padding-top: var(--spacing-md);
  min-height: 0;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .editor-view {
    border-radius: 0;
    min-height: 100%;
    background: var(--color-bg-secondary);
  }

  .editor-header {
    border-bottom: 1px solid var(--color-border-light);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-secondary);
    padding-bottom: var(--spacing-sm);
  }

  .editor-meta {
    order: 3;
    width: 100%;
  }

  .editor-body {
    padding-top: 0;
  }
}
</style>
