<script setup lang="ts">
import { Milkdown, useEditor } from '@milkdown/vue';
import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { commandsCtx, editorViewCtx } from '@milkdown/core';
import { callCommand, insert } from '@milkdown/utils';
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

import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

import { shallowRef } from 'vue';

const props = defineProps<{
  defaultValue: string;
  onChange?: (markdown: string) => void;
  imageUpload?: (file: File) => Promise<string>;
  fileUpload?: (file: File) => Promise<{ url: string; originalName: string; isImage: boolean }>;
}>();

const crepeRef = shallowRef<Crepe>();

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
        text: '开始写点什么...',
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
    api.markdownUpdated((_ctx: any, markdown: string) => {
      props.onChange?.(markdown);
    });
  });

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
</script>

<template>
  <div class="custom-editor-wrapper">
    <!-- Static Toolbar -->
    <div class="editor-toolbar">
      <button class="toolbar-btn font-bold" @mousedown.prevent="execCommand(toggleStrongCommand.key)" title="加粗 (Ctrl+B)">B</button>
      <button class="toolbar-btn italic" @mousedown.prevent="execCommand(toggleEmphasisCommand.key)" title="斜体 (Ctrl+I)">I</button>
      <button class="toolbar-btn line-through" @mousedown.prevent="execCommand(toggleStrikethroughCommand.key)" title="删除线">S</button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn" @mousedown.prevent="toggleList('bullet')" title="无序列表">• </button>
      <button class="toolbar-btn" @mousedown.prevent="toggleList('ordered')" title="有序列表">1. </button>
      <button class="toolbar-btn" @mousedown.prevent="toggleList('task')" title="待办清单">☑</button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn" @mousedown.prevent="execCommand(wrapInHeadingCommand.key, 2)" title="标题 (H2)">H2</button>
      <button class="toolbar-btn" @mousedown.prevent="execCommand(wrapInHeadingCommand.key, 3)" title="标题 (H3)">H3</button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn" @mousedown.prevent="triggerImagePick()" title="插入图片">🖼️</button>
      <button class="toolbar-btn" @mousedown.prevent="triggerFilePick()" title="上传附件">📎</button>
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
  background: var(--color-bg-primary);
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
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: background 0.2s;
}

.toolbar-btn:hover {
  background: var(--color-bg-hover);
}

.font-bold { font-weight: bold; }
.italic { font-style: italic; }
.line-through { text-decoration: line-through; }

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
</style>
