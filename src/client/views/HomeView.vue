<template>
  <div class="workspace-view">
    <!-- Left Pane: Notes List -->
    <div 
      class="notes-list-pane" 
      :class="{ 'mobile-hidden': !!route.query.noteId || !!route.query.newNote }"
      :style="{ width: listWidth + 'px', flex: 'none' }"
    >
      <div class="page-header desktop-only" style="justify-content: space-between; align-items: center; display: flex;">
        <h1 class="page-title">{{ pageTitle }}</h1>
        <button v-if="isTrash && notesStore.notes.length > 0" class="btn btn-ghost btn-sm text-danger" @click="emptyTrash" style="color: var(--color-danger);">
          清空回收站
        </button>
      </div>
      <!-- Mobile: trash empty button standalone -->
      <div v-if="isTrash && notesStore.notes.length > 0" class="mobile-only mobile-trash-header">
        <button class="btn btn-ghost btn-sm text-danger" @click="emptyTrash" style="color: var(--color-danger);">
          🗑️ 清空回收站
        </button>
      </div>

    <!-- Loading -->
    <div v-if="notesStore.loading" class="loading-spinner">
      <div class="spinner"></div>
    </div>

    <!-- Notes List -->
    <div v-else-if="notesStore.notes.length > 0" class="notes-grid">
      <!-- Pinned Section -->
      <template v-if="pinnedNotes.length > 0">
        <div class="section-label">置顶</div>
        <div
          v-for="note in pinnedNotes"
          :key="note.id"
          class="note-card card pinned"
          @click="openNote(note)"
        >
          <div class="note-card-header">
            <span class="pin-icon" title="已置顶">📌</span>
            <h3 class="note-title">{{ note.title }}</h3>
            <div class="note-actions">
              <button class="btn btn-ghost btn-icon btn-sm" @click.stop="togglePin(note)" title="取消置顶">📌</button>
              <button class="btn btn-ghost btn-icon btn-sm" @click.stop="deleteNote(note)" title="删除">🗑️</button>
            </div>
          </div>
          <p class="note-preview">{{ note.preview || '空笔记' }}</p>
          <div class="note-card-footer">
            <span class="note-category">{{ note.categoryName }}</span>
            <div v-if="note.tags.length" class="note-tags">
              <span v-for="tag in note.tags.slice(0, 3)" :key="tag.id" class="tag-badge">{{ tag.name }}</span>
            </div>
            <span class="note-time">{{ formatTime(note.updatedAt) }}</span>
          </div>
        </div>
      </template>

      <!-- Unpinned / Recent Section -->
      <template v-if="unpinnedNotes.length > 0">
        <div class="section-label">最近</div>
        <div
          v-for="note in unpinnedNotes"
          :key="note.id"
          class="note-card card"
          @click="openNote(note)"
        >
          <div class="note-card-header">
            <h3 class="note-title">{{ note.title }}</h3>
            <div class="note-actions">
              <button v-if="!isTrash" class="btn btn-ghost btn-icon btn-sm" @click.stop="togglePin(note)" title="置顶">📍</button>
              <button v-if="isTrash" class="btn btn-ghost btn-icon btn-sm" @click.stop="restoreNote(note)" title="恢复">♻️</button>
              <button class="btn btn-ghost btn-icon btn-sm" @click.stop="deleteNote(note)" :title="isTrash ? '永久删除' : '删除'">🗑️</button>
            </div>
          </div>
          <p class="note-preview">{{ note.preview || '空笔记' }}</p>
          <div class="note-card-footer">
            <span class="note-category">{{ note.categoryName }}</span>
            <div v-if="note.tags.length" class="note-tags">
              <span v-for="tag in note.tags.slice(0, 3)" :key="tag.id" class="tag-badge">{{ tag.name }}</span>
            </div>
            <span class="note-time">{{ formatTime(note.updatedAt) }}</span>
          </div>
        </div>
      </template>

      <!-- Trash: no grouping, show all with restore button -->
      <template v-if="isTrash">
        <div
          v-for="note in notesStore.notes"
          :key="note.id"
          class="note-card card"
          @click="openNote(note)"
        >
          <div class="note-card-header">
            <h3 class="note-title">{{ note.title }}</h3>
            <div class="note-actions">
              <button class="btn btn-ghost btn-icon btn-sm" @click.stop="restoreNote(note)" title="恢复">♻️</button>
              <button class="btn btn-ghost btn-icon btn-sm" @click.stop="deleteNote(note)" title="永久删除">🗑️</button>
            </div>
          </div>
          <p class="note-preview">{{ note.preview || '空笔记' }}</p>
          <div class="note-card-footer">
            <span class="note-category">{{ note.categoryName }}</span>
            <span class="note-time">{{ formatTime(note.updatedAt) }}</span>
          </div>
        </div>
      </template>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <div class="empty-state-icon">{{ isTrash ? '🗑️' : '📝' }}</div>
      <p class="empty-state-text">
        {{ isTrash ? '回收站是空的' : isSearch ? '没有找到匹配的笔记' : '还没有笔记' }}
      </p>
      <router-link v-if="!isTrash && !isSearch" to="/note/new" class="btn btn-primary">
        创建第一条笔记
      </router-link>
    </div>
    </div> <!-- Close notes-list-pane -->

    <!-- Drag Resizer -->
    <div 
      class="pane-resizer"
      :class="{ 'mobile-hidden': !!route.query.noteId || !!route.query.newNote }"
      @mousedown.prevent="startResize"
    ></div>

    <!-- Right Pane: Editor -->
    <div class="editor-pane" :class="{ 'mobile-hidden': !route.query.noteId && !route.query.newNote }">
      <NoteEditorView 
        v-if="route.query.noteId || route.query.newNote"
        :key="(route.query.noteId as string) || 'new'"
      />
      <div v-else class="empty-editor-state">
        <div class="empty-icon">📝</div>
        <p>请选择一条笔记或创建新笔记</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNotesStore, type NoteListItem } from '@/stores/notes';
import NoteEditorView from '@/views/NoteEditorView.vue';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();
const showToast = inject<(msg: string, type: string) => void>('showToast')!;

const isTrash = computed(() => route.name === 'Trash');
const isSearch = computed(() => route.name === 'Search');

const pinnedNotes = computed(() => isTrash.value ? [] : notesStore.notes.filter((n: any) => n.isPinned));
const unpinnedNotes = computed(() => isTrash.value ? [] : notesStore.notes.filter((n: any) => !n.isPinned));

const pageTitle = computed(() => {
  if (isTrash.value) return '回收站';
  if (isSearch.value) return `搜索: ${route.query.q || ''}`;
  if (route.name === 'Category') {
    const cat = notesStore.categories.find(c => c.id === route.params.id);
    return cat?.name || '分类';
  }
  if (route.name === 'Tag') {
    const tag = notesStore.tags.find(t => t.id === route.params.id);
    return `# ${tag?.name || '标签'}`;
  }
  return '首页';
});

function formatTime(dateStr: string): string {
  const d = new Date(dateStr + 'Z');
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString('zh-CN');
}

async function loadNotes() {
  if (isTrash.value) {
    await notesStore.fetchNotes({ trash: true });
  } else if (isSearch.value) {
    await notesStore.fetchNotes({ search: route.query.q as string });
  } else if (route.name === 'Category') {
    await notesStore.fetchNotes({ categoryId: route.params.id as string });
  } else if (route.name === 'Tag') {
    await notesStore.fetchNotes({ tagId: route.params.id as string });
  } else {
    await notesStore.fetchNotes();
  }
}

function openNote(note: NoteListItem) {
  if (isTrash.value) return;
  router.push({ path: route.path, query: { ...route.query, noteId: note.id, newNote: undefined } });
}

async function togglePin(note: NoteListItem) {
  try {
    await notesStore.togglePin(note.id);
    await loadNotes();
  } catch {
    showToast('操作失败', 'error');
  }
}

async function deleteNote(note: NoteListItem) {
  const msg = isTrash.value ? '确定永久删除这条笔记？此操作不可恢复。' : '确定将这条笔记移入回收站？';
  if (!confirm(msg)) return;

  try {
    await notesStore.deleteNote(note.id, isTrash.value);
    await loadNotes();
    showToast(isTrash.value ? '已永久删除' : '已移入回收站', 'success');
  } catch {
    showToast('删除失败', 'error');
  }
}

async function restoreNote(note: NoteListItem) {
  try {
    await notesStore.restoreNote(note.id);
    await loadNotes();
    showToast('笔记已恢复', 'success');
  } catch {
    showToast('恢复失败', 'error');
  }
}

async function emptyTrash() {
  if (!confirm('确定要清空回收站吗？所有笔记将被永久删除，不可恢复！')) return;
  try {
    await notesStore.emptyTrash();
    await loadNotes();
    showToast('回收站已清空', 'success');
  } catch {
    showToast('清空操作失败', 'error');
  }
}

// Resizer logic
const listWidth = ref(parseInt(localStorage.getItem('notesListWidth') || '320'));
const isResizing = ref(false);

function startResize() {
  isResizing.value = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function onMouseMove(e: MouseEvent) {
  if (!isResizing.value) return;
  const newWidth = Math.max(250, Math.min(800, e.clientX - 240));
  listWidth.value = newWidth;
}

function onMouseUp() {
  if (isResizing.value) {
    isResizing.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('notesListWidth', listWidth.value.toString());
  }
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  loadNotes();
});

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
});

watch(() => [route.name, route.params.id, route.query.q], loadNotes);
</script>

<style scoped>
.workspace-view {
  display: flex;
  height: calc(100vh - 80px);
  gap: var(--spacing-md);
}

.notes-list-pane {
  flex: none; /* Changed from flex: 1 to allow explicit width from style */
  display: flex;
  flex-direction: column;
  padding-right: var(--spacing-sm);
  overflow-y: auto;
}

.pane-resizer {
  width: 6px;
  cursor: col-resize;
  background-color: transparent;
  transition: background-color var(--transition-fast);
  margin: 0 -3px; /* Allow grabbing slightly outside the line */
  z-index: 10;
}

.pane-resizer:hover, .pane-resizer:active {
  background-color: var(--color-brand-primary);
}

.editor-pane {
  flex: 2;
  display: flex;
  flex-direction: column;
  min-width: 0; /* prevent flex blowout */
  border-radius: var(--radius-md);
  overflow: hidden;
}

.empty-editor-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--spacing-md);
  opacity: 0.5;
}

.notes-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.note-card {
  padding: var(--spacing-lg);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.note-card:hover {
  transform: translateY(-2px);
}

.note-card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.pin-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.note-title {
  flex: 1;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.note-card:hover .note-actions {
  opacity: 1;
}

.note-preview {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  max-height: 3em;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: var(--spacing-md);
}

.note-card-footer {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.note-category {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: var(--color-bg-hover);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.note-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.note-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-left: auto;
}

.note-card.pinned {
  border-left: 3px solid var(--color-accent);
}

.section-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-weight: 500;
  padding: var(--spacing-sm) 0 var(--spacing-xs);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.mobile-trash-header {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-xs) 0;
}

@media (max-width: 768px) {
  .workspace-view {
    display: block;
  }

  .notes-list-pane {
    max-width: none !important;
    width: auto !important;
    border-right: none;
    padding-right: 0;
  }

  .mobile-hidden {
    display: none !important;
  }

  .note-actions {
    opacity: 1;
  }

  .note-card {
    padding: var(--spacing-md);
  }

  .desktop-only {
    display: none !important;
  }
}

@media (min-width: 769px) {
  .mobile-only {
    display: none !important;
  }
}
</style>
