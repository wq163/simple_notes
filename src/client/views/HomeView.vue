<template>
  <div class="workspace-view">
    <!-- Left Pane: Notes List -->
    <div 
      ref="notesListPaneRef"
      class="notes-list-pane" 
      :class="{ 'mobile-hidden': !!route.query.noteId || !!route.query.newNote }"
      :style="{ width: listWidth + 'px' }"
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
          <Trash2 :size="17" aria-hidden="true" />
          清空回收站
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
        <article
          v-for="note in pinnedNotes"
          :key="note.id"
          class="note-card card pinned"
          :class="{ selected: selectedNoteId === note.id }"
        >
          <button class="note-card-open" @click="openNote(note)" :aria-current="selectedNoteId === note.id ? 'true' : undefined">
            <div class="note-card-header">
              <Pin class="pin-icon" :size="15" aria-hidden="true" />
              <h3 class="note-title">{{ note.title }}</h3>
            </div>
            <p class="note-preview">{{ note.preview || '空笔记' }}</p>
            <div class="note-card-footer">
              <span class="note-category">{{ note.categoryName }}</span>
              <div v-if="note.tags.length" class="note-tags">
                <span v-for="tag in note.tags.slice(0, 3)" :key="tag.id" class="tag-badge">{{ tag.name }}</span>
              </div>
              <span class="note-time">{{ formatTime(note.updatedAt) }}</span>
            </div>
          </button>
          <div class="note-actions">
            <button class="btn btn-ghost btn-icon btn-sm" @click="togglePin(note)" title="取消置顶" aria-label="取消置顶">
              <PinOff :size="17" aria-hidden="true" />
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" @click="deleteNote(note)" title="删除" aria-label="删除">
              <Trash2 :size="17" aria-hidden="true" />
            </button>
          </div>
        </article>
      </template>

      <!-- Unpinned / Recent Section -->
      <template v-if="unpinnedNotes.length > 0">
        <div class="section-label">最近</div>
        <article
          v-for="note in unpinnedNotes"
          :key="note.id"
          class="note-card card"
          :class="{ selected: selectedNoteId === note.id }"
        >
          <button class="note-card-open" @click="openNote(note)" :aria-current="selectedNoteId === note.id ? 'true' : undefined">
            <div class="note-card-header">
              <h3 class="note-title">{{ note.title }}</h3>
            </div>
            <p class="note-preview">{{ note.preview || '空笔记' }}</p>
            <div class="note-card-footer">
              <span class="note-category">{{ note.categoryName }}</span>
              <div v-if="note.tags.length" class="note-tags">
                <span v-for="tag in note.tags.slice(0, 3)" :key="tag.id" class="tag-badge">{{ tag.name }}</span>
              </div>
              <span class="note-time">{{ formatTime(note.updatedAt) }}</span>
            </div>
          </button>
          <div class="note-actions">
            <button class="btn btn-ghost btn-icon btn-sm" @click="togglePin(note)" title="置顶" aria-label="置顶">
              <Pin :size="17" aria-hidden="true" />
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" @click="deleteNote(note)" title="删除" aria-label="删除">
              <Trash2 :size="17" aria-hidden="true" />
            </button>
          </div>
        </article>
      </template>

      <!-- Trash: no grouping, show all with restore button -->
      <template v-if="isTrash">
        <article
          v-for="note in notesStore.notes"
          :key="note.id"
          class="note-card card"
        >
          <div class="note-card-open note-card-readonly">
            <div class="note-card-header">
              <h3 class="note-title">{{ note.title }}</h3>
            </div>
            <p class="note-preview">{{ note.preview || '空笔记' }}</p>
            <div class="note-card-footer">
              <span class="note-category">{{ note.categoryName }}</span>
              <span class="note-time">{{ formatTime(note.updatedAt) }}</span>
            </div>
          </div>
          <div class="note-actions">
            <button class="btn btn-ghost btn-icon btn-sm" @click="restoreNote(note)" title="恢复" aria-label="恢复">
              <RotateCcw :size="17" aria-hidden="true" />
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" @click="deleteNote(note)" title="永久删除" aria-label="永久删除">
              <Trash2 :size="17" aria-hidden="true" />
            </button>
          </div>
        </article>
      </template>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <Trash2 v-if="isTrash" class="empty-state-icon" :size="48" aria-hidden="true" />
      <NotebookPen v-else class="empty-state-icon" :size="48" aria-hidden="true" />
      <p class="empty-state-text">
        {{ isTrash ? '回收站是空的' : isSearch ? '没有找到匹配的笔记' : '还没有笔记' }}
      </p>
      <router-link v-if="!isTrash && !isSearch" :to="newNoteTarget" class="btn btn-primary">
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
    <div class="editor-pane" :class="{ 'mobile-hidden': !route.query.noteId && !route.query.newNote, 'mobile-editing': route.query.noteId || route.query.newNote }">
      <NoteEditorView 
        v-if="route.query.noteId || route.query.newNote"
        ref="editorRef"
        :key="editorKey"
      />
      <div v-else class="empty-editor-state">
        <NotebookPen class="empty-icon" :size="48" aria-hidden="true" />
        <p>请选择一条笔记或创建新笔记</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, inject, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NotebookPen, Pin, PinOff, RotateCcw, Trash2 } from '@lucide/vue';
import { useNotesStore, type NoteListItem } from '@/stores/notes';
import NoteEditorView from '@/views/NoteEditorView.vue';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();
const showToast = inject<(msg: string, type: string) => void>('showToast')!;
const editorRef = ref<{ flushSave: (showErrorFeedback?: boolean) => Promise<boolean> } | null>(null);

const isTrash = computed(() => route.name === 'Trash');
const isSearch = computed(() => route.name === 'Search');
const isNotebook = computed(() => route.name === 'Notebook');
const selectedNoteId = computed(() => route.query.noteId as string | undefined);
const isEditorOpen = computed(() => !!route.query.noteId || !!route.query.newNote);
const newNoteTarget = computed(() => ({
  path: route.path,
  query: { ...route.query, noteId: undefined, newNote: 'true' },
}));
const editorKey = computed(() => selectedNoteId.value
  || `new-${String(route.name)}-${String(route.params.id || '')}`);
const listContextKey = computed(() => JSON.stringify([
  route.name,
  route.params.id || '',
  route.query.q || '',
]));
const listScrollPositions = new Map<string, number>();

const pinnedNotes = computed(() => isTrash.value ? [] : notesStore.notes.filter((n: any) => n.isPinned));
const unpinnedNotes = computed(() => isTrash.value ? [] : notesStore.notes.filter((n: any) => !n.isPinned));

const pageTitle = computed(() => {
  if (isTrash.value) return '回收站';
  if (isSearch.value) return `搜索: ${route.query.q || ''}`;
  if (isNotebook.value) {
    const notebook = notesStore.notebooks.find(item => item.id === route.params.id);
    return notebook?.name || '笔记本';
  }
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
  } else if (isNotebook.value) {
    await notesStore.fetchNotes({ notebookId: route.params.id as string });
  } else if (route.name === 'Category') {
    await notesStore.fetchNotes({ categoryId: route.params.id as string });
  } else if (route.name === 'Tag') {
    await notesStore.fetchNotes({ tagId: route.params.id as string });
  } else {
    await notesStore.fetchNotes();
  }
}

async function openNote(note: NoteListItem) {
  if (isTrash.value) return;
  rememberListScroll();
  await router.push({ path: route.path, query: { ...route.query, noteId: note.id, newNote: undefined } });
  void restoreListScroll();
}

function rememberListScroll() {
  if (!notesListPaneRef.value) return;
  listScrollPositions.set(listContextKey.value, notesListPaneRef.value.scrollTop);
}

async function restoreListScroll() {
  const savedPosition = listScrollPositions.get(listContextKey.value);
  if (savedPosition === undefined) return;
  await nextTick();
  let attempts = 0;
  const applyPosition = () => {
    const pane = notesListPaneRef.value;
    if (!pane || attempts >= 30) return;
    if (getComputedStyle(pane).display === 'none') return;
    attempts++;
    pane.scrollTop = savedPosition;
    if (Math.abs(pane.scrollTop - savedPosition) > 1) {
      requestAnimationFrame(applyPosition);
    }
  };
  requestAnimationFrame(applyPosition);
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
    if (selectedNoteId.value === note.id && editorRef.value) {
      const saved = await editorRef.value.flushSave();
      if (!saved) {
        showToast('保存失败，已取消删除', 'error');
        return;
      }
    }
    await notesStore.deleteNote(note.id, isTrash.value);
    if (selectedNoteId.value === note.id) {
      const newQuery = { ...route.query };
      delete newQuery.noteId;
      delete newQuery.newNote;
      await router.replace({ path: route.path, query: newQuery });
    }
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
const notesListPaneRef = ref<HTMLElement>();
const listWidth = ref(parseInt(localStorage.getItem('notesListWidth') || '360'));
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

watch(
  [() => route.name, () => route.params.id, () => route.query.q],
  loadNotes,
);
watch(isEditorOpen, (open, wasOpen) => {
  if (!open && wasOpen) void restoreListScroll();
});
</script>

<style scoped>
.workspace-view {
  display: flex;
  height: 100%;
  overflow: hidden;
  gap: var(--spacing-sm);
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
  border-radius: 0 0 0 var(--radius-md);
  background: var(--color-bg-secondary);
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
  border-radius: inherit;
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
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
  transition: all var(--transition-normal);
}

.note-card:hover {
  transform: translateY(-2px);
}

.note-card.selected {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
  box-shadow: 0 8px 24px var(--color-shadow);
  background: var(--color-accent-light);
}

.note-card-open {
  width: 100%;
  padding: var(--spacing-lg);
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.note-card-readonly {
  cursor: default;
}

.note-card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  padding-right: 76px;
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
  position: absolute;
  top: var(--spacing-md);
  right: var(--spacing-md);
  display: flex;
  gap: var(--spacing-xs);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.note-card:hover .note-actions,
.note-card:focus-within .note-actions {
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
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .notes-list-pane {
    max-width: none !important;
    width: auto !important;
    border-right: none;
    margin-right: calc(-1 * var(--spacing-md));
    padding-right: var(--spacing-md);
    flex: 1; /* when shown and no note selected */
    min-height: 0;
    padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
  }

  .editor-pane.mobile-editing {
    flex: 1;
    border-radius: 0;
    height: 100%;
  }

  .mobile-hidden {
    display: none !important;
  }

  .note-actions {
    opacity: 1;
  }

  .note-card {
    transform: none;
  }

  .note-card-open {
    padding: var(--spacing-md);
  }

  .note-actions {
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    gap: var(--spacing-sm);
  }

  .desktop-only {
    display: none !important;
  }
}

@media (min-width: 769px) {
  .notes-list-pane {
    padding-top: var(--spacing-md);
  }

  .notes-list-pane .page-header {
    margin-bottom: 0;
  }

  .editor-pane {
    margin-left: calc(-1 * var(--spacing-md));
    padding-top: var(--spacing-md);
    padding-right: var(--spacing-md);
    padding-left: var(--spacing-md);
  }

  .mobile-only {
    display: none !important;
  }
}
</style>
