<template>
  <div id="app-root" :class="{ 'dark-mode': isDark }">
    <div class="toast-container" v-if="toasts.length">
      <div v-for="toast in toasts" :key="toast.id"
           class="toast" :class="`toast-${toast.type}`">
        {{ toast.message }}
      </div>
    </div>
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, onMounted, computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';

const settingsStore = useSettingsStore();
const isDark = computed(() => settingsStore.theme === 'dark');

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const toasts = ref<Toast[]>([]);
let toastId = 0;

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const id = ++toastId;
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, 3000);
}

provide('showToast', showToast);

onMounted(() => {
  settingsStore.applyTheme();
});
</script>

<style scoped>
#app-root {
  height: 100%;
}
</style>
