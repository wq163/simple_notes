<template>
  <div class="editor-view">
    <div class="editor-header">
      <button class="btn btn-ghost back-btn" @click="goBack">← 返回</button>
      <div class="editor-meta">
        <select v-model="selectedCategory" class="form-input category-select">
          <option v-for="cat in notesStore.categories" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>
      </div>
      <div class="editor-actions">
        <button class="btn btn-primary" @click="saveNote" :disabled="saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>


    <!-- Milkdown Editor Area -->
    <div class="editor-body" v-if="editorReady">
      <MilkdownWrapper
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
import { ref, onMounted, inject, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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

const isEditing = computed(() => !!route.query.noteId);
const noteId = computed(() => route.query.noteId as string);

function goBack() {
  const newQuery = { ...route.query };
  delete newQuery.noteId;
  delete newQuery.newNote;
  router.push({ path: route.path, query: newQuery });
}

function handleContentChange(markdown: string) {
  currentContent.value = markdown;
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

async function saveNote() {
  saving.value = true;
  try {
    const content = currentContent.value || initialContent.value;
    
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
        categoryId: selectedCategory.value,
        tagIds: selectedTags.value,
      });
      showToast('保存成功', 'success');
    } else {
      const id = await notesStore.createNote(content, selectedCategory.value, selectedTags.value);
      showToast('创建成功', 'success');
      router.replace({ path: route.path, query: { ...route.query, noteId: id, newNote: undefined } });
    }

    // Refresh tags and notes to reflect new inline tags
    await notesStore.fetchTags();
    await notesStore.fetchNotes();
  } catch (e: any) {
    showToast(e.response?.data?.error || '保存失败', 'error');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await notesStore.fetchCategories();
  await notesStore.fetchTags();

  // Set default category
  const defaultCat = notesStore.categories.find(c => c.isDefault);
  if (defaultCat) selectedCategory.value = defaultCat.id;

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

  editorReady.value = true;
});
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
  padding-bottom: var(--spacing-md);
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
</style>
