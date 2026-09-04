<template>
  <div class="main-layout">
    <!-- Mobile overlay -->
    <div v-if="sidebarOpen" class="sidebar-overlay mobile-only" @click="sidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <NotebookPen class="sidebar-logo" :size="24" aria-hidden="true" />
          <span class="sidebar-app-name">Simple Notes</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item" :class="{ active: isHome }" @click="closeSidebar">
          <Home class="nav-icon" :size="18" aria-hidden="true" />
          <span class="nav-text">首页</span>
        </router-link>

        <div class="notebooks-divider">
          <span>笔记本</span>
          <div class="notebooks-divider-actions">
            <button type="button" class="nav-manage-icon" @click="openNotebookModal" title="新建笔记本" aria-label="新建笔记本">
              <span aria-hidden="true">+</span>
            </button>
            <router-link to="/categories" class="nav-manage-icon" @click="closeSidebar" title="管理笔记本与分类">
              <Settings :size="16" aria-hidden="true" />
              <span class="sr-only">管理笔记本与分类</span>
            </router-link>
          </div>
        </div>

        <div v-for="notebook in notesStore.notebooks" :key="notebook.id" class="nav-section notebook-section">
          <div class="nav-section-heading" :class="{ active: route.params.id === notebook.id && route.name === 'Notebook' }">
            <router-link
              :to="`/notebook/${notebook.id}`"
              class="nav-section-header notebook-link"
              :class="{ active: route.params.id === notebook.id && route.name === 'Notebook' }"
              @click="closeSidebar"
            >
              <Folder class="nav-icon" :size="18" aria-hidden="true" />
              <span class="nav-text">{{ notebook.name }}</span>
            </router-link>
            <button
              type="button"
              class="notebook-toggle"
              @click="toggleNotebook(notebook.id)"
              :aria-expanded="isNotebookExpanded(notebook.id)"
              :aria-label="`${isNotebookExpanded(notebook.id) ? '收起' : '展开'}${notebook.name}分类`"
            >
              <ChevronRight class="nav-arrow" :class="{ expanded: isNotebookExpanded(notebook.id) }" :size="15" aria-hidden="true" />
            </button>
          </div>
          <div v-if="isNotebookExpanded(notebook.id)" class="nav-sub-list">
            <router-link
              v-for="cat in categoriesForNotebook(notebook.id)"
              :key="cat.id"
              :to="`/category/${cat.id}`"
              class="nav-sub-item"
              :class="{ active: route.params.id === cat.id && route.name === 'Category' }"
              @click="closeSidebar"
            >
              <span>{{ cat.name }}</span>
            </router-link>
          </div>
        </div>

        <!-- Tags Section -->
        <div class="nav-section tags-section">
          <div class="nav-section-heading">
            <button type="button" class="nav-section-header" @click="showTags = !showTags" :aria-expanded="showTags">
              <Tags class="nav-icon" :size="18" aria-hidden="true" />
              <span class="nav-text">标签</span>
            </button>
            <router-link to="/tags" class="nav-manage-icon" @click.stop title="管理标签">
              <Settings :size="16" aria-hidden="true" />
              <span class="sr-only">管理标签</span>
            </router-link>
          </div>
          <div v-if="showTags" class="nav-sub-list">
            <router-link
              v-for="tag in notesStore.tags.filter(item => item.noteCount > 0)"
              :key="tag.id"
              :to="`/tag/${tag.id}`"
              class="nav-sub-item"
              :class="{ active: route.params.id === tag.id && route.name === 'Tag' }"
              @click="closeSidebar"
            >
              <span># {{ tag.name }}</span>
              <span class="nav-count">{{ tag.noteCount }}</span>
            </router-link>
          </div>
        </div>

        <router-link to="/trash" class="nav-item" :class="{ active: route.name === 'Trash' }" @click="closeSidebar">
          <Trash2 class="nav-icon" :size="18" aria-hidden="true" />
          <span class="nav-text">回收站</span>
        </router-link>

        <router-link to="/settings" class="nav-item" :class="{ active: route.name === 'Settings' }" @click="closeSidebar">
          <Settings class="nav-icon" :size="18" aria-hidden="true" />
          <span class="nav-text">设置</span>
        </router-link>
      </nav>

      <!-- Sidebar Footer: User info -->
      <div class="sidebar-footer">
        <router-link to="/account" class="user-info" @click="closeSidebar">
          <div class="user-avatar">{{ authStore.user?.displayName?.charAt(0) || '?' }}</div>
          <div class="user-details">
            <div class="user-name">{{ authStore.user?.displayName }}</div>
            <div class="user-role">{{ authStore.user?.role === 'admin' ? '管理员' : '用户' }}</div>
          </div>
        </router-link>
        <button v-if="authStore.isAdmin" class="btn btn-ghost btn-icon" @click="$router.push('/admin/users'); closeSidebar()" title="用户管理" aria-label="用户管理">
          <Users :size="18" aria-hidden="true" />
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Top Bar -->
      <header class="top-bar" :class="{ 'mobile-hidden': isMobileEditing }">
        <button class="btn btn-ghost btn-icon hamburger" @click="sidebarOpen = !sidebarOpen" aria-label="打开导航" :aria-expanded="sidebarOpen">
          <Menu :size="21" aria-hidden="true" />
        </button>

        <!-- Mobile: show page title in top bar -->
        <span class="topbar-title mobile-only">{{ mobileTitle }}</span>

        <!-- Desktop: search bar -->
        <div class="search-bar desktop-only">
          <Search class="search-icon" :size="16" aria-hidden="true" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="搜索笔记..."
            aria-label="搜索笔记"
            @keydown.enter="doSearch"
          />
          <button v-if="searchQuery" type="button" class="search-clear" @click="clearSearch" aria-label="清除搜索">
            <X :size="15" aria-hidden="true" />
          </button>
        </div>

        <!-- Mobile: search icon -->
        <button class="btn btn-ghost btn-icon topbar-search-btn mobile-only" @click="mobileSearchOpen = !mobileSearchOpen" aria-label="搜索笔记" :aria-expanded="mobileSearchOpen">
          <Search :size="20" aria-hidden="true" />
        </button>

        <router-link :to="newNoteTarget" class="btn btn-primary btn-sm desktop-only">
          <Plus :size="17" aria-hidden="true" />
          新建笔记
        </router-link>
      </header>

      <!-- Mobile search dropdown -->
      <div v-if="mobileSearchOpen" class="mobile-search-bar mobile-only">
        <div class="search-bar">
          <Search class="search-icon" :size="16" aria-hidden="true" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="搜索笔记..."
            aria-label="搜索笔记"
            autofocus
            @keydown.enter="submitMobileSearch"
          />
          <button v-if="searchQuery" type="button" class="search-clear" @click="clearSearch" aria-label="清除搜索">
            <X :size="15" aria-hidden="true" />
          </button>
        </div>
      </div>

      <!-- Page Content -->
      <div class="content-area" :class="{ 'editing-mode': isMobileEditing, 'workspace-content': isNotesWorkspace }">
        <router-view />
      </div>
    </main>

    <!-- FAB for mobile -->
    <button
      ref="fabRef"
      type="button"
      v-show="!isMobileEditing"
      class="fab mobile-only"
      :class="{ 'fab-dragging': fabDragging }"
      :style="fabStyle"
      aria-label="新建笔记"
      title="新建笔记，可拖动调整位置"
      @pointerdown="startFabDrag"
      @click="handleFabClick"
    >
      <Plus :size="28" aria-hidden="true" />
    </button>

    <div v-if="showNotebookModal" class="modal-overlay" @click.self="closeNotebookModal">
      <div ref="notebookDialogRef" class="modal-content" role="dialog" aria-modal="true" aria-labelledby="new-notebook-title" tabindex="-1">
        <div class="modal-header">
          <h2 id="new-notebook-title" class="modal-title">新建笔记本</h2>
          <button class="btn btn-ghost btn-icon" @click="closeNotebookModal" aria-label="关闭">
            <X :size="18" aria-hidden="true" />
          </button>
        </div>
        <div class="form-group">
          <label class="form-label" for="sidebar-notebook-name">笔记本名称</label>
          <input id="sidebar-notebook-name" v-model="newNotebookName" class="form-input" placeholder="输入笔记本名称" @keydown.enter="createNotebook" data-autofocus />
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeNotebookModal">取消</button>
          <button class="btn btn-primary" @click="createNotebook" :disabled="creatingNotebook || !newNotebookName.trim()">
            {{ creatingNotebook ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ChevronRight,
  Folder,
  Home,
  Menu,
  NotebookPen,
  Plus,
  Search,
  Settings,
  Tags,
  Trash2,
  Users,
  X,
} from '@lucide/vue';
import { useAuthStore } from '@/stores/auth';
import { useNotesStore } from '@/stores/notes';
import { useSettingsStore } from '@/stores/settings';
import { useModalFocus } from '@/composables/useModalFocus';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notesStore = useNotesStore();
const settingsStore = useSettingsStore();
const showToast = inject<(msg: string, type: string) => void>('showToast')!;

const sidebarOpen = ref(window.innerWidth > 768);
const showTags = ref(true);
const searchQuery = ref('');
const mobileSearchOpen = ref(false);
const expandedNotebooks = ref<Record<string, boolean>>({});
const showNotebookModal = ref(false);
const newNotebookName = ref('');
const creatingNotebook = ref(false);

type FabPosition = { left: number; top: number };
type FabDragStart = FabPosition & { x: number; y: number; pointerId: number };
const fabRef = ref<HTMLButtonElement | null>(null);
const fabDragging = ref(false);
const fabPosition = ref<FabPosition | null>(readFabPosition());
let fabDragStart: FabDragStart | null = null;
let suppressFabClick = false;

const isHome = computed(() => route.name === 'Home');
const isMobileEditing = computed(() => !!route.query.noteId || !!route.query.newNote);
const isNotesWorkspace = computed(() => ['Home', 'Notebook', 'Category', 'Tag', 'Search', 'Trash'].includes(String(route.name)));
const newNoteTarget = computed(() => ({
  path: route.path,
  query: { ...route.query, noteId: undefined, newNote: 'true' },
}));
const { dialogRef: notebookDialogRef } = useModalFocus(showNotebookModal, closeNotebookModal);

// Mobile top bar title — mirrors the page title from HomeView
const mobileTitle = computed(() => {
  const name = route.name;
  if (name === 'Trash') return '回收站';
  if (name === 'Search') return `搜索: ${route.query.q || ''}`;
  if (name === 'Settings') return '设置';
  if (name === 'Account') return '账号';
  if (name === 'AdminUsers') return '用户管理';
  if (name === 'Categories') return '笔记本与分类';
  if (name === 'Tags') return '标签管理';
  if (name === 'Category') {
    const cat = notesStore.categories.find((c: any) => c.id === route.params.id);
    return cat?.name || '分类';
  }
  if (name === 'Notebook') {
    const notebook = notesStore.notebooks.find(item => item.id === route.params.id);
    return notebook?.name || '笔记本';
  }
  if (name === 'Tag') {
    const tag = notesStore.tags.find((t: any) => t.id === route.params.id);
    return `# ${tag?.name || '标签'}`;
  }
  return '首页';
});

function closeSidebar() {
  if (window.innerWidth <= 768) {
    sidebarOpen.value = false;
  }
}

function categoriesForNotebook(notebookId: string) {
  return notesStore.categories.filter(category => category.notebookId === notebookId);
}

function isNotebookExpanded(notebookId: string) {
  return expandedNotebooks.value[notebookId] ?? false;
}

function toggleNotebook(notebookId: string) {
  expandedNotebooks.value[notebookId] = !isNotebookExpanded(notebookId);
}

function openNotebookModal() {
  newNotebookName.value = '';
  showNotebookModal.value = true;
}

function closeNotebookModal() {
  showNotebookModal.value = false;
  newNotebookName.value = '';
}

async function createNotebook() {
  const name = newNotebookName.value.trim();
  if (!name || creatingNotebook.value) return;
  creatingNotebook.value = true;
  try {
    const notebook = await notesStore.createNotebook(name);
    expandedNotebooks.value[notebook.id] = true;
    showToast('笔记本已创建', 'success');
    closeNotebookModal();
  } catch (e: any) {
    showToast(e.response?.data?.error || '创建笔记本失败', 'error');
  } finally {
    creatingNotebook.value = false;
  }
}

function doSearch() {
  const query = searchQuery.value.trim();
  return query
    ? router.push({ name: 'Search', query: { q: query } })
    : router.push({ name: 'Home' });
}

async function submitMobileSearch() {
  await doSearch();
  mobileSearchOpen.value = false;
}

function clearSearch() {
  searchQuery.value = '';
  if (route.name === 'Search') void router.push({ name: 'Home' });
}

// Handle window resize
function onResize() {
  sidebarOpen.value = window.innerWidth > 768;
  if (fabPosition.value) {
    fabPosition.value = clampFabPosition(fabPosition.value);
    persistFabPosition(fabPosition.value);
  }
}

function readFabPosition(): FabPosition | null {
  try {
    const stored = JSON.parse(localStorage.getItem('notesFabPosition') || 'null');
    if (stored && Number.isFinite(stored.left) && Number.isFinite(stored.top)) {
      return { left: stored.left, top: stored.top };
    }
  } catch {
    // Ignore malformed or unavailable local storage.
  }
  return null;
}

function persistFabPosition(position: FabPosition) {
  try {
    localStorage.setItem('notesFabPosition', JSON.stringify(position));
  } catch {
    // Ignore unavailable local storage.
  }
}

function clampFabPosition(position: FabPosition): FabPosition {
  const element = getFabElement();
  const width = element?.offsetWidth || 56;
  const height = element?.offsetHeight || 56;
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft || 0;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportWidth = viewport?.width || window.innerWidth;
  const viewportHeight = viewport?.height || window.innerHeight;
  const safeAreaBottom = element
    ? parseFloat(getComputedStyle(element).getPropertyValue('--fab-safe-area-bottom')) || 0
    : 0;
  return {
    left: Math.min(
      Math.max(viewportLeft + 8, position.left),
      Math.max(viewportLeft + 8, viewportLeft + viewportWidth - width - 8),
    ),
    top: Math.min(
      Math.max(viewportTop + 8, position.top),
      Math.max(viewportTop + 8, viewportTop + viewportHeight - height - safeAreaBottom - 8),
    ),
  };
}

function getFabElement(): HTMLButtonElement | null {
  return fabRef.value;
}

const fabStyle = computed(() => {
  if (!fabPosition.value) return undefined;
  return {
    left: `${fabPosition.value.left}px`,
    top: `${fabPosition.value.top}px`,
    right: 'auto',
    bottom: 'auto',
  };
});

function startFabDrag(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const element = getFabElement();
  const rect = element?.getBoundingClientRect();
  if (!rect) return;
  fabDragStart = {
    x: event.clientX,
    y: event.clientY,
    left: rect.left,
    top: rect.top,
    pointerId: event.pointerId,
  };
  fabDragging.value = false;
  suppressFabClick = false;
  window.addEventListener('pointermove', moveFabDrag, { passive: false });
  window.addEventListener('pointerup', endFabDrag);
  window.addEventListener('pointercancel', endFabDrag);
  try {
    element?.setPointerCapture(event.pointerId);
  } catch {
    // Window-level listeners still keep the drag active if capture is unavailable.
  }
}

function moveFabDrag(event: PointerEvent) {
  if (!fabDragStart || event.pointerId !== fabDragStart.pointerId) return;
  const deltaX = event.clientX - fabDragStart.x;
  const deltaY = event.clientY - fabDragStart.y;
  if (!fabDragging.value && Math.hypot(deltaX, deltaY) < 3) return;

  fabDragging.value = true;
  suppressFabClick = true;
  event.preventDefault();
  fabPosition.value = clampFabPosition({
    left: fabDragStart.left + deltaX,
    top: fabDragStart.top + deltaY,
  });
}

function endFabDrag(event: PointerEvent) {
  if (!fabDragStart || event.pointerId !== fabDragStart.pointerId) return;
  const element = getFabElement();
  if (element?.hasPointerCapture(event.pointerId)) {
    element.releasePointerCapture(event.pointerId);
  }
  if (fabDragging.value && fabPosition.value) persistFabPosition(fabPosition.value);
  fabDragStart = null;
  fabDragging.value = false;
  removeFabDragListeners();
}

function handleFabClick(event: MouseEvent) {
  if (suppressFabClick) {
    event.preventDefault();
    event.stopPropagation();
    suppressFabClick = false;
    return;
  }
  void router.push(newNoteTarget.value);
}

function removeFabDragListeners() {
  window.removeEventListener('pointermove', moveFabDrag);
  window.removeEventListener('pointerup', endFabDrag);
  window.removeEventListener('pointercancel', endFabDrag);
}

onMounted(async () => {
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  await Promise.all([
    notesStore.fetchNotebooks(),
    notesStore.fetchCategories(),
    notesStore.fetchTags(),
    settingsStore.fetchSettings(),
  ]);
  for (const notebook of notesStore.notebooks) {
    expandedNotebooks.value[notebook.id] = notebook.isDefault;
  }
  if (fabPosition.value) {
    fabPosition.value = clampFabPosition(fabPosition.value);
    persistFabPosition(fabPosition.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  window.visualViewport?.removeEventListener('resize', onResize);
  removeFabDragListeners();
});

watch(
  () => [route.name, route.query.q],
  () => {
    searchQuery.value = route.name === 'Search' ? String(route.query.q || '') : '';
  },
  { immediate: true },
);
</script>

<style scoped>
.main-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  height: 100%;
  background: var(--color-bg-sidebar);
  display: flex;
  flex-direction: column;
  transition: transform var(--transition-slow);
  z-index: 200;
  overflow-y: auto;
}

.sidebar-header {
  padding: var(--spacing-lg) var(--spacing-md) var(--spacing-md);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.sidebar-logo {
  color: var(--color-accent);
  flex-shrink: 0;
}

.sidebar-app-name {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text-primary);
}

.sidebar-nav {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-sm);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 10px 14px 10px 16px;
  border-radius: 0;
  color: var(--color-text-sidebar);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
  margin: 0 calc(-1 * var(--spacing-sm)) 2px;
  text-decoration: none;
}

.nav-item:hover:not(.active) {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.nav-item.active {
  background: var(--color-accent-light);
  color: var(--color-text-sidebar-active);
  font-weight: 500;
}

.nav-icon {
  width: 24px;
  flex-shrink: 0;
}

.nav-section {
  margin-bottom: 4px;
}

.notebooks-divider {
  min-height: 28px;
  margin: var(--spacing-sm) calc(-1 * var(--spacing-sm)) 4px;
  padding: 0 var(--spacing-sm) 0 var(--spacing-md);
  border-radius: 0;
  background: var(--color-bg-hover);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.notebooks-divider-actions {
  display: flex;
  align-items: center;
}

.notebooks-divider .nav-manage-icon > span {
  font-size: 22px;
  font-weight: 400;
  line-height: 1;
}

.notebooks-divider .nav-manage-icon {
  flex-basis: 36px;
  width: 36px;
  height: 28px;
}

.nav-section-heading {
  display: flex;
  align-items: center;
  margin: 0 calc(-1 * var(--spacing-sm));
  padding-right: var(--spacing-sm);
  border-radius: 0;
  transition: background var(--transition-fast);
}

.nav-section-heading:hover {
  background: var(--color-bg-hover);
}

.nav-section-heading.active {
  background: var(--color-accent-light);
  color: var(--color-text-sidebar-active);
}

.nav-section-header {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 10px 14px 10px 16px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--color-text-sidebar);
  font-size: var(--font-size-sm);
  font-family: var(--font-family);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.nav-section-header:hover {
  background: transparent;
  color: var(--color-text-primary);
}

.nav-section-heading.active .notebook-link {
  background: transparent;
  color: var(--color-text-sidebar-active);
  font-weight: 500;
}

.notebook-toggle {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-sidebar);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.notebook-toggle:hover {
  background: transparent;
  color: var(--color-text-primary);
}

.notebook-toggle .nav-arrow {
  margin-left: 0;
}

.nav-arrow.expanded {
  transform: rotate(90deg);
}

.nav-manage-icon {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.nav-manage-icon:hover {
  opacity: 1;
  background: transparent;
}

.nav-arrow {
  margin-left: auto;
  transition: transform var(--transition-fast);
}

.nav-sub-list {
  padding-left: var(--spacing-lg);
}

.nav-sub-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 calc(-1 * var(--spacing-sm)) 1px calc(-1 * var(--spacing-lg) - var(--spacing-sm));
  padding: 8px var(--spacing-sm) 8px 48px;
  border-radius: 0;
  color: var(--color-text-sidebar);
  font-size: var(--font-size-xs);
  transition: all var(--transition-fast);
  text-decoration: none;
}

.nav-sub-item:hover:not(.active) {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.nav-sub-item.active {
  background: var(--color-accent-light);
  color: var(--color-text-sidebar-active);
  font-weight: 500;
}

.tags-section .nav-count {
  margin-right: 10px;
}

.nav-count {
  font-size: 11px;
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
  padding: 1px 7px;
  border-radius: var(--radius-full);
}

.manage-link {
  opacity: 0.6;
  font-size: var(--font-size-xs);
}

.manage-link:hover {
  opacity: 1;
}

/* Sidebar Footer */
.sidebar-footer {
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
  text-decoration: none;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.user-info:hover {
  background: var(--color-bg-hover);
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: var(--color-accent-gradient);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  color: var(--color-text-sidebar);
  font-size: var(--font-size-xs);
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.top-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-light);
}

.hamburger {
  flex-shrink: 0;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}

/* Mobile overlay */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 150;
}

/* Responsive */
@media (min-width: 769px) {
  .sidebar:not(.open) {
    margin-left: calc(-1 * var(--sidebar-width));
  }

  .content-area.workspace-content {
    padding: 0 0 var(--spacing-md) var(--spacing-md);
  }
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    transform: translateX(-100%);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .nav-item,
  .nav-section-header,
  .nav-sub-item {
    min-height: 44px;
  }

  .notebooks-divider {
    min-height: 44px;
    margin: 2px calc(-1 * var(--spacing-sm));
    padding-right: var(--spacing-sm);
    position: relative;
    background: transparent;
  }

  .notebooks-divider::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 28px;
    transform: translateY(-50%);
    background: var(--color-bg-hover);
  }

  .notebooks-divider > span,
  .notebooks-divider-actions {
    position: relative;
    z-index: 1;
  }

  .notebook-toggle {
    flex-basis: 44px;
    width: 44px;
    height: 44px;
  }

  .notebooks-divider .nav-manage-icon {
    flex-basis: 44px;
    width: 44px;
    height: 44px;
  }

  .nav-manage-icon {
    flex-basis: 44px;
    width: 44px;
    height: 44px;
  }

  .content-area {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-primary);
    display: flex;
    flex-direction: column;
  }

  .content-area.workspace-content {
    min-height: 0;
    overflow: hidden;
  }

  .content-area.editing-mode {
    padding: 0;
    background: var(--color-bg-secondary);
  }

  .mobile-hidden {
    display: none !important;
  }

  .top-bar {
    background: #55A2AF;
    color: #ffffff;
    border-bottom: none;
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .hamburger {
    color: #ffffff;
  }

  .topbar-title {
    flex: 1;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .topbar-search-btn {
    color: #ffffff;
    font-size: 18px;
  }

  .mobile-search-bar {
    padding: var(--spacing-xs) var(--spacing-md) var(--spacing-sm);
    background: #55A2AF;
    border-bottom: none;
  }

  .mobile-search-bar .search-bar {
    max-width: 100%;
  }
}

@media (min-width: 769px) {
  .mobile-only {
    display: none !important;
  }
}
</style>
