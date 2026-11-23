<template>
  <details ref="dropdown" class="list-style-menu" @keydown.esc="dismissWithKeyboard" @focusout="closeOnFocusOut">
    <summary ref="trigger" class="btn btn-ghost btn-icon list-style-trigger" aria-label="列表样式" title="列表样式">
      <component :is="settings.noteListStyle === 'cards' ? LayoutList : List" :size="20" aria-hidden="true" />
    </summary>
    <div class="list-style-options">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="btn btn-ghost list-style-option"
        :aria-pressed="settings.noteListStyle === option.value"
        @click="selectStyle(option.value)"
      >
        <component :is="option.icon" :size="17" aria-hidden="true" />
        {{ option.label }}
        <Check v-if="settings.noteListStyle === option.value" class="list-style-check" :size="16" aria-hidden="true" />
      </button>
    </div>
  </details>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Check, LayoutList, List } from '@lucide/vue';
import { useSettingsStore, type NoteListStyle } from '@/stores/settings';

const settings = useSettingsStore();
const dropdown = ref<HTMLDetailsElement | null>(null);
const trigger = ref<HTMLElement | null>(null);
const options = [
  { value: 'cards', label: '圆角卡片', icon: LayoutList },
  { value: 'flat', label: '分隔线列表', icon: List },
] as const;

function close(restoreFocus = false) {
  if (!dropdown.value?.open) return;
  dropdown.value.open = false;
  if (restoreFocus) trigger.value?.focus();
}

function selectStyle(style: NoteListStyle) {
  settings.setNoteListStyle(style);
  close(true);
}

function dismissWithKeyboard(event: KeyboardEvent) {
  if (!dropdown.value?.open) return;
  event.stopPropagation();
  close(true);
}

function closeOnFocusOut(event: FocusEvent) {
  if (!dropdown.value?.contains(event.relatedTarget as Node | null)) close();
}

function closeOnOutsideClick(event: PointerEvent) {
  if (!dropdown.value?.contains(event.target as Node)) close();
}

onMounted(() => document.addEventListener('pointerdown', closeOnOutsideClick));
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutsideClick));
</script>

<style scoped>
.list-style-menu {
  position: relative;
  flex: none;
}

.list-style-trigger {
  width: 44px;
  height: 44px;
  list-style: none;
}

.list-style-trigger::-webkit-details-marker {
  display: none;
}

.list-style-menu[open] {
  z-index: 20;
}

.list-style-menu[open] .list-style-trigger {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.list-style-options {
  position: absolute;
  top: calc(100% + var(--spacing-xs));
  right: 0;
  min-width: 10rem;
  display: grid;
  gap: 2px;
  padding: var(--spacing-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  box-shadow: 0 4px 16px var(--color-shadow);
}

.list-style-option {
  justify-content: flex-start;
  min-height: 44px;
  padding: var(--spacing-sm);
}

.list-style-option[aria-pressed="true"] {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.list-style-check {
  margin-left: auto;
}
</style>
