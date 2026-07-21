<template>
  <MilkdownProvider>
    <MilkdownEditor
      ref="editorRef"
      :default-value="defaultValue"
      :on-change="onChange"
      :image-upload="imageUpload"
      :file-upload="fileUpload"
    />
  </MilkdownProvider>
</template>

<script setup lang="ts">
import { MilkdownProvider } from '@milkdown/vue';
import { ref } from 'vue';
import MilkdownEditor from './MilkdownEditorInner.vue';

const props = defineProps<{
  defaultValue: string;
  onChange?: (markdown: string) => void;
  imageUpload?: (file: File) => Promise<string>;
  fileUpload?: (file: File) => Promise<{ url: string; originalName: string; isImage: boolean }>;
}>();

const editorRef = ref<{ getMarkdown: () => string } | null>(null);

function getMarkdown() {
  return editorRef.value?.getMarkdown() ?? props.defaultValue;
}

defineExpose({ getMarkdown });
</script>
