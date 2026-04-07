<template>
  <MilkdownProvider>
    <MilkdownEditor
      :default-value="defaultValue"
      :on-change="onChange"
      :image-upload="imageUpload"
      :file-upload="fileUpload"
    />
  </MilkdownProvider>
</template>

<script setup lang="ts">
import { MilkdownProvider } from '@milkdown/vue';
import MilkdownEditor from './MilkdownEditorInner.vue';

defineProps<{
  defaultValue: string;
  onChange?: (markdown: string) => void;
  imageUpload?: (file: File) => Promise<string>;
  fileUpload?: (file: File) => Promise<{ url: string; originalName: string; isImage: boolean }>;
}>();
</script>
