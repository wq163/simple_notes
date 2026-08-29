<script setup lang="ts">
import { Milkdown, useEditor } from '@milkdown/vue';
import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { commandsCtx, editorViewCtx } from '@milkdown/core';
import { callCommand, insert, $prose } from '@milkdown/utils';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInHeadingCommand,
  wrapInBlockTypeCommand,
  listItemSchema,
  bulletListSchema,
  orderedListSchema,
  liftListItemCommand
} from '@milkdown/preset-commonmark';
import { toggleStrikethroughCommand } from '@milkdown/preset-gfm';
import {
  Bold,
  Ellipsis,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Paperclip,
  Strikethrough,
} from '@lucide/vue';

import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

import { shallowRef, ref } from 'vue';
const showFolded = ref(false);

const props = defineProps<{
  defaultValue: string;
  onChange?: (markdown: string) => void;
  imageUpload?: (file: File) => Promise<string>;
  fileUpload?: (file: File) => Promise<{ url: string; originalName: string; isImage: boolean }>;
}>();

const crepeRef = shallowRef<Crepe>();
let lastReportedMarkdown: string | null = null;

const { get } = useEditor((root) => {
  const crepe = new Crepe({
    root,
    defaultValue: props.defaultValue,
    // Disable features the user doesn't need
    features: {
      [CrepeFeature.CodeMirror]: false,
      [CrepeFeature.Table]: false,
      [CrepeFeature.Latex]: false,
      [CrepeFeature.Toolbar]: true,
    },
    featureConfigs: {
      [CrepeFeature.Placeholder]: {
        text: '首个非空行将作为标题，开始写点什么…',
      },
      [CrepeFeature.ImageBlock]: {
        onUpload: props.imageUpload
          ? async (file: File) => {
              const url = await props.imageUpload!(file);
              return url;
            }
          : undefined,
      },
    },
  });

  // Add markdown change listener
  crepe.on((api: any) => {
    api.mounted(() => {
      lastReportedMarkdown = crepe.getMarkdown();
    });
    api.markdownUpdated((_ctx: any, markdown: string) => {
      lastReportedMarkdown = markdown;
      props.onChange?.(markdown);
    });
    api.blur(() => {
      const markdown = crepe.getMarkdown();
      if (lastReportedMarkdown !== null && markdown !== lastReportedMarkdown) {
        lastReportedMarkdown = markdown;
        props.onChange?.(markdown);
      }
    });
  });

  // Register clipboard paste handler for images
  const pasteUploadPlugin = $prose(() => new Plugin({
    key: new PluginKey('clipboard-image-paste'),
    props: {
      handlePaste(view, event) {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // Check for image files in clipboard
        const items = Array.from(clipboardData.items);
        const imageItem = items.find(item => item.type.startsWith('image/'));
        if (!imageItem) return false;

        const file = imageItem.getAsFile();
        if (!file) return false;

        // Prevent default paste behavior for images
        event.preventDefault();

        // Upload and insert asynchronously
        (async () => {
          try {
            if (props.fileUpload) {
              const result = await props.fileUpload(file);
              insertMarkdown(`![${result.originalName}](${result.url})`);
            } else if (props.imageUpload) {
              const url = await props.imageUpload(file);
              insertMarkdown(`![${file.name}](${url})`);
            }
          } catch {
            // Upload failed, error already shown by the upload handler
          }
        })();

        return true;
      },
    },
  }));

  crepe.editor.use(pasteUploadPlugin);

  crepeRef.value = crepe;
  return crepe;
});

function execCommand(command: any, payload?: any) {
  let editorObj = crepeRef.value as any;
  if (!editorObj) return;
  // If useEditor unwrapped it, it might not have .editor
  const actionRunner = editorObj.action ? editorObj : editorObj.editor;
  if (actionRunner && actionRunner.action) {
    actionRunner.action(callCommand(command, payload));
  }
}

function toggleList(type: 'bullet' | 'ordered' | 'task') {
  let editorObj = crepeRef.value as any;
  if (!editorObj) return;
  const actionRunner = editorObj.action ? editorObj : editorObj.editor;
  if (actionRunner && actionRunner.action) {
    actionRunner.action((ctx: any) => {
      const commands = ctx.get(commandsCtx);
      const view = ctx.get(editorViewCtx);
      const { state } = view;
      const { $from } = state.selection;

      // Detect current list type
      let currentType: 'bullet' | 'ordered' | 'task' | null = null;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === 'bullet_list') {
          // Check if it's a task list (child list_item has 'checked' attr)
          let isTask = false;
          for (let c = $from.depth; c > d; c--) {
            const childNode = $from.node(c);
            if (childNode.type.name === 'list_item' && childNode.attrs.checked != null) {
              isTask = true;
              break;
            }
          }
          currentType = isTask ? 'task' : 'bullet';
          break;
        } else if (node.type.name === 'ordered_list') {
          currentType = 'ordered';
          break;
        }
      }

      // If we are already in the target list type, we just unwrap (lift) it.
      if (currentType === type) {
        commands.call(liftListItemCommand.key);
      } else {
        // If we are in a DIFFERENT list type, we must unwrap it first.
        if (currentType !== null) {
          commands.call(liftListItemCommand.key);
        }
        
        // Now wrap it in the new list type
        if (type === 'bullet') {
          const bulletList = bulletListSchema.type(ctx);
          commands.call(wrapInBlockTypeCommand.key, { nodeType: bulletList });
        } else if (type === 'ordered') {
          const orderedList = orderedListSchema.type(ctx);
          commands.call(wrapInBlockTypeCommand.key, { nodeType: orderedList });
        } else if (type === 'task') {
          const listItem = listItemSchema.type(ctx);
          commands.call(wrapInBlockTypeCommand.key, {
            nodeType: listItem,
            attrs: { checked: false }
          });
        }
      }
    });
  }
}

// --- File upload handlers ---
const imageInputRef = shallowRef<HTMLInputElement>();
const fileInputRef = shallowRef<HTMLInputElement>();

function triggerImagePick() {
  imageInputRef.value?.click();
}

function triggerFilePick() {
  fileInputRef.value?.click();
}

function insertMarkdown(md: string) {
  let editorObj = crepeRef.value as any;
  if (!editorObj) return;
  const actionRunner = editorObj.action ? editorObj : editorObj.editor;
  if (actionRunner && actionRunner.action) {
    actionRunner.action(insert(md));
  }
}

async function onImageFilePicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = ''; // reset

  if (props.fileUpload) {
    try {
      const result = await props.fileUpload(file);
      insertMarkdown(`![${result.originalName}](${result.url})`);
    } catch {}
  } else if (props.imageUpload) {
    try {
      const url = await props.imageUpload(file);
      insertMarkdown(`![${file.name}](${url})`);
    } catch {}
  }
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = ''; // reset

  if (props.fileUpload) {
    try {
      const result = await props.fileUpload(file);
      if (result.isImage) {
        insertMarkdown(`![${result.originalName}](${result.url})`);
      } else {
        insertMarkdown(`[📎 ${result.originalName}](${result.url}?download=1)`);
      }
    } catch {}
  }
}

function getMarkdown() {
  return crepeRef.value?.getMarkdown() ?? props.defaultValue;
}

defineExpose({ getMarkdown });
</script>

<template>
  <div class="custom-editor-wrapper">
    <!-- Static Toolbar -->
    <div class="editor-toolbar" role="toolbar" aria-label="编辑工具栏">
      <button type="button" class="toolbar-btn" @mousedown.prevent="execCommand(toggleStrongCommand.key)" @keydown.enter.space.prevent="execCommand(toggleStrongCommand.key)" title="加粗 (Ctrl+B)" aria-label="加粗">
        <Bold :size="18" aria-hidden="true" />
      </button>
      <button type="button" class="toolbar-btn" @mousedown.prevent="execCommand(toggleStrikethroughCommand.key)" @keydown.enter.space.prevent="execCommand(toggleStrikethroughCommand.key)" title="删除线" aria-label="删除线">
        <Strikethrough :size="18" aria-hidden="true" />
      </button>
      <div class="toolbar-divider"></div>
      <button type="button" class="toolbar-btn" @mousedown.prevent="toggleList('bullet')" @keydown.enter.space.prevent="toggleList('bullet')" title="无序列表" aria-label="无序列表">
        <List :size="18" aria-hidden="true" />
      </button>
      <button type="button" class="toolbar-btn" @mousedown.prevent="toggleList('ordered')" @keydown.enter.space.prevent="toggleList('ordered')" title="有序列表" aria-label="有序列表">
        <ListOrdered :size="18" aria-hidden="true" />
      </button>
      <button type="button" class="toolbar-btn" @mousedown.prevent="toggleList('task')" @keydown.enter.space.prevent="toggleList('task')" title="待办清单" aria-label="待办清单">
        <ListChecks :size="18" aria-hidden="true" />
      </button>
      <div class="toolbar-divider"></div>
      <button type="button" class="toolbar-btn" @mousedown.prevent="triggerImagePick()" @keydown.enter.space.prevent="triggerImagePick()" title="插入图片" aria-label="插入图片">
        <ImagePlus :size="18" aria-hidden="true" />
      </button>
      <button type="button" class="toolbar-btn mobile-more-btn" @mousedown.prevent="showFolded = !showFolded" @keydown.enter.space.prevent="showFolded = !showFolded" title="更多选项" aria-label="更多选项" :aria-expanded="showFolded">
        <Ellipsis :size="20" aria-hidden="true" />
      </button>
      <button type="button" class="toolbar-btn foldable" :class="{ 'is-open': showFolded }" @mousedown.prevent="execCommand(toggleEmphasisCommand.key)" @keydown.enter.space.prevent="execCommand(toggleEmphasisCommand.key)" title="斜体 (Ctrl+I)" aria-label="斜体">
        <Italic :size="18" aria-hidden="true" />
      </button>
      <button type="button" class="toolbar-btn foldable" :class="{ 'is-open': showFolded }" @mousedown.prevent="execCommand(wrapInHeadingCommand.key, 2)" @keydown.enter.space.prevent="execCommand(wrapInHeadingCommand.key, 2)" title="标题 (H2)" aria-label="二级标题">
        <Heading2 :size="18" aria-hidden="true" />
      </button>
      <button type="button" class="toolbar-btn foldable" :class="{ 'is-open': showFolded }" @mousedown.prevent="execCommand(wrapInHeadingCommand.key, 3)" @keydown.enter.space.prevent="execCommand(wrapInHeadingCommand.key, 3)" title="标题 (H3)" aria-label="三级标题">
        <Heading3 :size="18" aria-hidden="true" />
      </button>
      <div class="toolbar-divider foldable" :class="{ 'is-open': showFolded }"></div>
      <button type="button" class="toolbar-btn foldable" :class="{ 'is-open': showFolded }" @mousedown.prevent="triggerFilePick()" @keydown.enter.space.prevent="triggerFilePick()" title="上传附件" aria-label="上传附件">
        <Paperclip :size="18" aria-hidden="true" />
      </button>
    </div>

    <!-- Hidden file inputs -->
    <input ref="imageInputRef" type="file" accept="image/*" style="display:none" @change="onImageFilePicked" />
    <input ref="fileInputRef" type="file" style="display:none" @change="onFilePicked" />

    <!-- Milkdown Editor -->
    <div class="editor-content-area">
      <Milkdown />
    </div>
  </div>
</template>

<style>
.custom-editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg-secondary);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 8px;
  gap: 4px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  flex-wrap: wrap;
}

.toolbar-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-md);
  transition: background 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toolbar-btn:hover {
  background: var(--color-bg-hover);
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  margin: 0 4px;
}

.editor-content-area {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

/* Override some Milkdown Crepe styles to fit our design */
.milkdown .editor {
  min-height: 300px;
  font-family: var(--font-family);
  color: var(--color-text-primary);
  line-height: 1.8;
}

.milkdown .editor:focus {
  outline: none;
}

.milkdown .ProseMirror {
  min-height: 300px;
  padding: 16px;
}

.milkdown .ProseMirror:focus {
  outline: none;
}

/* Adapt to dark mode */
[data-theme="dark"] .milkdown {
  --crepe-color-background: var(--color-bg-primary);
  --crepe-color-surface: var(--color-bg-card);
  --crepe-color-on-background: var(--color-text-primary);
  --crepe-color-on-surface: var(--color-text-primary);
  --crepe-color-outline: var(--color-border);
}

.mobile-more-btn {
  display: none;
}

@media (max-width: 768px) {
  .custom-editor-wrapper {
    border: none;
    border-radius: 0;
  }
  .editor-content-area {
    order: 1;
  }
  .editor-toolbar {
    order: 2;
    border-bottom: none;
    border-top: 1px solid var(--color-border);
    padding: 8px 4px;
    padding-bottom: env(safe-area-inset-bottom, 8px);
    gap: 8px;
  }
  .toolbar-btn {
    width: 44px;
    height: 44px;
  }
  .mobile-more-btn {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
  }
  .foldable {
    display: none !important;
  }
  .foldable.is-open {
    display: inline-block !important;
  }
  .toolbar-divider.foldable.is-open {
    display: block !important;
  }
}

</style>
