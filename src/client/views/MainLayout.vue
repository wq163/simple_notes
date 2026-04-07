<template>
  <div class="main-layout">
    <!-- Mobile overlay -->
    <div v-if="sidebarOpen" class="sidebar-overlay mobile-only" @click="sidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <span class="sidebar-logo">📝</span>
          <span class="sidebar-app-name">Simple Notes</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item" :class="{ active: isHome }" @click="closeSidebar">
          <span class="nav-icon">🏠</span>
          <span class="nav-text">首页</span>
        </router-link>

        <!-- Categories Section -->
        <div class="nav-section">
          <div class="nav-section-header" @click="showCategories = !showCategories">
            <span class="nav-icon">📁</span>
            <span class="nav-text">分类</span>
            <router-link to="/categories" class="nav-manage-icon" @click.stop title="管理分类">
              ⚙️
            </router-link>
            <span class="nav-arrow" :class="{ expanded: showCategories }">▸</span>
          </div>
          <div v-if="showCategories" class="nav-sub-list">
            <router-link
              v-for="cat in notesStore.categories.filter((c: any) => !c.isDefault)"
              :key="cat.id"
              :to="`/category/${cat.id}`"
              class="nav-sub-item"
              :class="{ active: route.params.id === cat.id && route.name === 'Category' }"
              @click="closeSidebar"
            >
              <span>{{ cat.name }}</span>
              <span class="nav-count">{{ cat.noteCount }}</span>
            </router-link>
          </div>
        </div>

        <!-- Tags Section -->
        <div class="nav-section">
          <div class="nav-section-header" @click="showTags = !showTags">
            <span class="nav-icon">🏷️</span>
            <span class="nav-text">标签</span>
            <router-link to="/tags" class="nav-manage-icon" @click.stop title="管理标签">
              ⚙️
            </router-link>
            <span class="nav-arrow" :class="{ expanded: showTags }">▸</span>
          </div>
          <div v-if="showTags" class="nav-sub-list">
            <router-link
              v-for="tag in notesStore.tags"
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
          <span class="nav-icon">🗑️</span>
          <span class="nav-text">回收站</span>
        </router-link>

        <router-link to="/settings" class="nav-item" :class="{ active: route.name === 'Settings' }" @click="closeSidebar">
          <span class="nav-icon">⚙️</span>
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
        <button v-if="authStore.isAdmin" class="btn btn-ghost btn-sm" @click="$router.push('/admin/users'); closeSidebar()" title="用户管理">
          👥
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Top Bar -->
      <header class="top-bar">
        <button class="btn btn-ghost btn-icon hamburger" @click="sidebarOpen = !sidebarOpen">
          ☰
        </button>

        <!-- Mobile: show page title in top bar -->
        <span class="topbar-title mobile-only">{{ mobileTitle }}</span>

        <!-- Desktop: search bar -->
        <div class="search-bar desktop-only">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索笔记..."
            @keydown.enter="doSearch"
          />
        </div>

        <!-- Mobile: search icon -->
        <button class="btn btn-ghost btn-icon topbar-search-btn mobile-only" @click="mobileSearchOpen = !mobileSearchOpen">
          🔍
        </button>

        <router-link :to="{ path: route.path, query: { newNote: 'true' } }" class="btn btn-primary btn-sm desktop-only">
          + 新建笔记
        </router-link>
      </header>

      <!-- Mobile search dropdown -->
      <div v-if="mobileSearchOpen" class="mobile-search-bar mobile-only">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索笔记..."
            autofocus
            @keydown.enter="doSearch; mobileSearchOpen = false"
          />
        </div>
      </div>

      <!-- Page Content -->
      <div class="content-area">
        <router-view />
      </div>
    </main>

    <!-- FAB for mobile -->
    <router-link :to="{ path: route.path, query: { newNote: 'true' } }" class="fab mobile-only">+</router-link>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useNotesStore } from '@/stores/notes';
import { useSettingsStore } from '@/stores/settings';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notesStore = useNotesStore();
const settingsStore = useSettingsStore();

const sidebarOpen = ref(window.innerWidth > 768);
const showCategories = ref(true);
const showTags = ref(true);
const searchQuery = ref('');
const mobileSearchOpen = ref(false);

const isHome = computed(() => route.name === 'Home');

// Mobile top bar title — mirrors the page title from HomeView
const mobileTitle = computed(() => {
  const name = route.name;
  if (name === 'Trash') return '回收站';
  if (name === 'Search') return `搜索: ${route.query.q || ''}`;
  if (name === 'Settings') return '设置';
  if (name === 'Account') return '账号';
  if (name === 'AdminUsers') return '用户管理';
  if (name === 'Categories') return '分类管理';
  if (name === 'Tags') return '标签管理';
  if (name === 'Category') {
    const cat = notesStore.categories.find((c: any) => c.id === route.params.id);
    return cat?.name || '分类';
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

function doSearch() {
  if (searchQuery.value.trim()) {
    router.push({ name: 'Search', query: { q: searchQuery.value.trim() } });
  }
}

// Handle window resize
function onResize() {
  sidebarOpen.value = window.innerWidth > 768;
}

onMounted(async () => {
  window.addEventListener('resize', onResize);
  await Promise.all([
    notesStore.fetchCategories(),
    notesStore.fetchTags(),
    settingsStore.fetchSettings(),
  ]);
});
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
  font-size: 24px;
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
  padding: 10px 14px;
  border-radius: var(--radius-md);
  color: var(--color-text-sidebar);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
  margin-bottom: 2px;
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
  font-size: 16px;
  width: 24px;
  text-align: center;
}

.nav-section {
  margin-bottom: 4px;
}

.nav-section-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 10px 14px;
  border-radius: var(--radius-md);
  color: var(--color-text-sidebar);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-section-header:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.nav-arrow.expanded {
  transform: rotate(90deg);
}

.nav-manage-icon {
  margin-left: auto;
  font-size: 14px;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.nav-manage-icon:hover {
  opacity: 1;
}

.nav-arrow {
  margin-left: var(--spacing-sm);
  font-size: 12px;
  transition: transform var(--transition-fast);
}

.nav-sub-list {
  padding-left: var(--spacing-lg);
}

.nav-sub-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  color: var(--color-text-sidebar);
  font-size: var(--font-size-xs);
  transition: all var(--transition-fast);
  text-decoration: none;
  margin-bottom: 1px;
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
  font-size: 20px;
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

  .content-area {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-primary);
  }

  .top-bar {
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    border-bottom: 1px solid var(--color-border-light);
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .hamburger {
    color: var(--color-text-primary);
  }

  .topbar-title {
    flex: 1;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .topbar-search-btn {
    color: var(--color-text-secondary);
    font-size: 18px;
  }

  .mobile-search-bar {
    padding: var(--spacing-xs) var(--spacing-md) var(--spacing-sm);
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border-light);
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
