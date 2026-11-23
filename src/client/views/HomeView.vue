<template>
  <div ref="workspaceRef" class="workspace-view" :style="{ '--notes-list-width': listWidth + 'px' }">
    <!-- Left Pane: Notes List -->
    <div 
      ref="notesListPaneRef"
      class="notes-list-pane" 
      id="notes-list-pane"
      :class="{
        'mobile-hidden': isEditorOpen,
        'flat-list-pane': settingsStore.noteListStyle === 'flat',
      }"
    >
      <h1 class="sr-only">{{ pageTitle }}</h1>
      <div v-if="isTrash && !notesStore.loading && notesStore.notes.length > 0" class="trash-list-actions">
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
    <div v-else-if="notesStore.notes.length > 0" class="notes-grid" :class="{ 'flat-list': settingsStore.noteListStyle === 'flat' }">
      <template v-for="section in noteSections" :key="section.label">
        <div class="section-label">{{ section.label }}</div>
        <article
          v-for="note in section.notes"
          :key="note.id"
          class="note-card card"
          :class="{ pinned: note.isPinned, selected: selectedNoteId === note.id }"
        >
          <button class="note-card-open" @click="openNote(note)" :aria-current="selectedNoteId === note.id ? 'true' : undefined">
            <div class="note-card-header">
              <Pin v-if="note.isPinned" class="pin-icon" :size="15" aria-hidden="true" />
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
          <div class="note-actions desktop-only">
            <button class="btn btn-ghost btn-icon btn-sm" @click="togglePin(note)" :title="note.isPinned ? '取消置顶' : '置顶'" :aria-label="note.isPinned ? '取消置顶' : '置顶'">
              <component :is="note.isPinned ? PinOff : Pin" :size="17" aria-hidden="true" />
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" @click="deleteNote(note)" title="删除" aria-label="删除">
              <Trash2 :size="17" aria-hidden="true" />
            </button>
          </div>
          <details class="note-more mobile-only" name="note-actions">
            <summary class="btn btn-ghost btn-icon" :aria-label="`笔记操作：${note.title}`">
              <Ellipsis :size="20" aria-hidden="true" />
            </summary>
            <div class="note-more-actions">
              <button type="button" class="btn btn-ghost" @click="togglePin(note)">
                <component :is="note.isPinned ? PinOff : Pin" :size="17" aria-hidden="true" />
                {{ note.isPinned ? '取消置顶' : '置顶' }}
              </button>
              <button type="button" class="btn btn-ghost" @click="deleteNote(note)">
                <Trash2 :size="17" aria-hidden="true" />
                删除
              </button>
            </div>
          </details>
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
      :class="{ resizing: isResizing }"
      role="separator"
      tabindex="0"
      aria-label="调整笔记列表宽度"
      aria-controls="notes-list-pane"
      aria-orientation="vertical"
      :aria-valuemin="notesListMinWidth"
      :aria-valuemax="maxListWidth"
      :aria-valuenow="listWidth"
      @mousedown.prevent="startResize"
      @keydown.left.prevent="resizeListBy(-16)"
      @keydown.right.prevent="resizeListBy(16)"
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
import { Ellipsis, NotebookPen, Pin, PinOff, RotateCcw, Trash2 } from '@lucide/vue';
import { useNotesStore, type NoteListItem } from '@/stores/notes';
import { useSettingsStore } from '@/stores/settings';
import NoteEditorView from '@/views/NoteEditorView.vue';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();
const settingsStore = useSettingsStore();
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

const noteSections = computed(() => isTrash.value ? [] : [
  { label: '置顶', notes: notesStore.notes.filter(note => note.isPinned) },
  { label: '最近', notes: notesStore.notes.filter(note => !note.isPinned) },
].filter(section => section.notes.length));

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
const workspaceRef = ref<HTMLElement>();
const notesListPaneRef = ref<HTMLElement>();
const notesListMinWidth = 250;
const notesListMaxWidth = 800;
const editorMinWidth = 380;
const workspaceWidth = ref(window.innerWidth);
const preferredListWidth = ref(parseInt(localStorage.getItem('notesListWidth') || '', 10) || 360);
const maxListWidth = computed(() => Math.max(notesListMinWidth, Math.min(notesListMaxWidth, workspaceWidth.value - editorMinWidth)));
const listWidth = computed(() => clampListWidth(preferredListWidth.value));
const isResizing = ref(false);
let resizeStart: { x: number; width: number } | null = null;
let workspaceObserver: ResizeObserver | undefined;

function clampListWidth(width: number) {
  return Math.max(notesListMinWidth, Math.min(maxListWidth.value, width));
}

function startResize(event: MouseEvent) {
  if (event.button !== 0) return;
  resizeStart = { x: event.clientX, width: listWidth.value };
  isResizing.value = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function onMouseMove(e: MouseEvent) {
  if (!resizeStart) return;
  preferredListWidth.value = clampListWidth(resizeStart.width + e.clientX - resizeStart.x);
}

function finishResize() {
  if (!resizeStart) return;
  if (listWidth.value !== resizeStart.width) {
    localStorage.setItem('notesListWidth', listWidth.value.toString());
  }
  resizeStart = null;
  isResizing.value = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

function resizeListBy(delta: number) {
  preferredListWidth.value = clampListWidth(listWidth.value + delta);
  localStorage.setItem('notesListWidth', listWidth.value.toString());
}

onMounted(() => {
  const workspace = workspaceRef.value;
  if (workspace) {
    workspaceWidth.value = workspace.clientWidth;
    workspaceObserver = new ResizeObserver(() => { workspaceWidth.value = workspace.clientWidth; });
    workspaceObserver.observe(workspace);
  }
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', finishResize);
  loadNotes();
});

onBeforeUnmount(() => {
  finishResize();
  workspaceObserver?.disconnect();
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', finishResize);
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
  scrollbar-width: none;
}

@supports not (scrollbar-width: none) {
  .notes-list-pane::-webkit-scrollbar {
    display: none;
  }
}

.pane-resizer {
  display: none;
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
  gap: var(--spacing-sm);
}

.note-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  box-shadow: none;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.note-card:hover {
  border-color: var(--color-border);
  box-shadow: none;
}

.note-card.selected {
  border-color: var(--color-accent);
  background: var(--color-accent-light);
}

.note-card-open {
  width: 100%;
  padding: var(--spacing-md);
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

.note-card-open:focus-visible {
  outline-offset: -3px;
}

.note-card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  padding-right: 76px;
}

.pin-icon {
  color: var(--color-accent);
  margin-top: 3px;
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

.note-card-open:not(.note-card-readonly) .note-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal;
  overflow-wrap: anywhere;
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
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  max-height: 3em;
  overflow: hidden;
  margin-bottom: var(--spacing-sm);
}

.note-card-footer {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.note-category {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-tags {
  display: flex;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.note-tags .tag-badge {
  display: block;
  min-width: 0;
  padding: 1px 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-left: auto;
  white-space: nowrap;
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

.notes-grid:not(.flat-list) .section-label {
  padding-inline-start: calc(var(--spacing-md) + 1px);
}

.notes-grid.flat-list {
  gap: 0;
  background: var(--color-bg-card);
}

.notes-grid.flat-list .section-label {
  margin: 0;
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-bg-hover);
  font-weight: 600;
  line-height: 1rem;
}

.flat-list .note-card {
  border: 0;
  border-radius: 0;
  background: transparent;
}

.flat-list .note-card + .note-card {
  border-top: 1px solid var(--color-border-light);
}

.flat-list .note-card:hover {
  background: var(--color-bg-hover);
}

.flat-list .note-card.selected {
  background: var(--color-accent-light);
}

.trash-list-actions {
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
    padding-right: 0;
    flex: 1; /* when shown and no note selected */
    min-height: 0;
    padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
  }

  .flat-list-pane {
    background: var(--color-bg-card);
  }

  .section-label {
    line-height: 1rem;
    padding: 0;
    margin-bottom: calc(-1 * var(--spacing-xs));
  }

  .note-card + .section-label {
    margin-top: var(--spacing-xs);
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

  .note-card-open:not(.note-card-readonly) .note-card-header {
    padding-right: 34px;
  }

  .note-more summary {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 44px;
    height: 44px;
    list-style: none;
  }

  .note-more summary::-webkit-details-marker {
    display: none;
  }

  .note-more[open] summary {
    color: var(--color-accent);
    background: var(--color-accent-light);
  }

  .note-more-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-xs);
    padding: 0 var(--spacing-sm) var(--spacing-xs);
  }

  .note-more-actions .btn {
    min-height: 44px;
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
  .workspace-view {
    position: relative;
    display: grid;
    grid-template-columns: var(--notes-list-width) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    gap: 0;
  }

  .pane-resizer {
    display: block;
    position: absolute;
    inset: 0 auto 0 var(--notes-list-width);
    width: 12px;
    transform: translateX(-50%);
    cursor: col-resize;
    z-index: 10;
  }

  .pane-resizer::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 50%;
    width: 1px;
    background: var(--color-border-light);
  }

  .pane-resizer:hover::before,
  .pane-resizer:focus-visible::before,
  .pane-resizer.resizing::before {
    width: 2px;
    background: var(--color-accent);
  }

  .notes-list-pane.flat-list-pane {
    padding-inline-end: 0;
  }

  .flat-list-pane .trash-list-actions {
    padding-inline: var(--spacing-md);
  }

  .note-card-open:not(.note-card-readonly) .note-card-header {
    padding-right: 0;
  }

  .note-card-open:not(.note-card-readonly) {
    padding-bottom: var(--spacing-sm);
  }

  .note-card-open:not(.note-card-readonly) .note-card-footer {
    min-height: 30px;
    padding-right: 68px;
  }

  .note-actions.desktop-only {
    top: auto;
    bottom: var(--spacing-sm);
  }

  .note-actions.desktop-only .btn {
    width: 30px;
    height: 30px;
    padding: 0;
  }

  .editor-pane {
    padding-top: var(--spacing-md);
    padding-right: var(--spacing-md);
    padding-left: var(--spacing-md);
  }

  .mobile-only {
    display: none !important;
  }
}
</style>
