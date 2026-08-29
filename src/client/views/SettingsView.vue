<template>
  <div class="settings-view">
    <div class="page-header">
      <h1 class="page-title">设置</h1>
    </div>

    <div class="settings-sections">
      <!-- Theme -->
      <div class="settings-card card">
        <h3 class="settings-section-title">外观</h3>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">主题</span>
            <span class="setting-desc">切换浅色/深色模式</span>
          </div>
          <div class="theme-toggle">
            <button
              class="theme-btn" :class="{ active: settingsStore.theme === 'light' }"
              :aria-pressed="settingsStore.theme === 'light'"
              @click="updateTheme('light')"
            >
              <Sun :size="16" aria-hidden="true" />
              浅色
            </button>
            <button
              class="theme-btn" :class="{ active: settingsStore.theme === 'dark' }"
              :aria-pressed="settingsStore.theme === 'dark'"
              @click="updateTheme('dark')"
            >
              <Moon :size="16" aria-hidden="true" />
              深色
            </button>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">字体大小</span>
            <span class="setting-desc">{{ settingsStore.fontSize }}px</span>
          </div>
          <input
            aria-label="字体大小"
            type="range"
            :value="settingsStore.fontSize"
            min="12" max="24" step="1"
            class="range-input"
            @input="updateFontSize($event)"
          />
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">默认编辑器模式</span>
            <span class="setting-desc">新建笔记时的默认模式</span>
          </div>
          <select
            aria-label="默认编辑器模式"
            :value="settingsStore.defaultEditorMode"
            class="form-input select-sm"
            @change="updateEditorMode($event)"
          >
            <option value="edit">编辑</option>
            <option value="preview">预览</option>
          </select>
        </div>
      </div>

      <!-- Data -->
      <div class="settings-card card">
        <h3 class="settings-section-title">数据</h3>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">导出数据</span>
            <span class="setting-desc">将所有笔记和附件导出为 ZIP 文件</span>
          </div>
          <button class="btn btn-secondary btn-sm" @click="exportData" :disabled="exporting">
            <Download :size="16" aria-hidden="true" />
            {{ exporting ? '导出中...' : '导出' }}
          </button>
        </div>

        <!-- Remote Backup (Admin Only) -->
        <div v-if="authStore.isAdmin" class="setting-item">
          <div class="setting-label">
            <span class="setting-name">远程备份</span>
            <span class="setting-desc">将整个数据目录备份到 S3 兼容对象存储</span>
          </div>
          <div class="setting-actions">
            <button class="btn btn-ghost btn-sm" @click="openBackupConfig">
              <Settings :size="16" aria-hidden="true" />
              配置
            </button>
            <button class="btn btn-primary btn-sm" @click="runBackup" :disabled="backingUp">
              <CloudUpload :size="16" aria-hidden="true" />
              {{ backingUp ? '备份中...' : '备份' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- S3 Config Modal -->
    <div v-if="showS3Modal" class="modal-overlay" @click.self="closeS3Modal">
      <div ref="dialogRef" class="modal-content s3-modal" role="dialog" aria-modal="true" aria-labelledby="s3-dialog-title" tabindex="-1">
        <div class="modal-header s3-modal-header">
          <h3 id="s3-dialog-title" class="modal-title">S3 备份配置</h3>
          <button class="btn btn-ghost btn-icon" @click="closeS3Modal" aria-label="关闭">
            <X :size="18" aria-hidden="true" />
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="s3-endpoint">S3 Endpoint</label>
            <input id="s3-endpoint" v-model="s3Form.s3Endpoint" class="form-input" placeholder="https://s3.amazonaws.com" data-autofocus />
          </div>
          <div class="form-group">
            <label class="form-label" for="s3-region">Region</label>
            <input id="s3-region" v-model="s3Form.s3Region" class="form-input" placeholder="us-east-1" />
          </div>
          <div class="form-group">
            <label class="form-label" for="s3-bucket">Bucket</label>
            <input id="s3-bucket" v-model="s3Form.s3Bucket" class="form-input" placeholder="my-notes-backup" />
          </div>
          <div class="form-group">
            <label class="form-label" for="s3-access-key">Access Key</label>
            <input id="s3-access-key" v-model="s3Form.s3AccessKey" class="form-input" placeholder="AKIAIOSFODNN7EXAMPLE" />
          </div>
          <div class="form-group">
            <label class="form-label" for="s3-secret-key">Secret Key</label>
            <input id="s3-secret-key" v-model="s3Form.s3SecretKey" type="password" class="form-input" placeholder="输入新密钥或保留 ****" />
          </div>
          <div class="form-row">
            <div class="form-group form-group-half">
              <label class="form-label" for="s3-path-prefix">路径前缀</label>
              <input id="s3-path-prefix" v-model="s3Form.s3PathPrefix" class="form-input" placeholder="notes-backup" />
            </div>
            <div class="form-group form-group-half">
              <label class="form-label" for="s3-retention-count">保留数量</label>
              <input id="s3-retention-count" v-model.number="s3Form.retentionCount" type="number" min="1" max="100" class="form-input" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost btn-sm" @click="testS3Connection" :disabled="testingConnection">
            <Link2 :size="16" aria-hidden="true" />
            {{ testingConnection ? '测试中...' : '测试连接（不保存）' }}
          </button>
          <div class="modal-footer-right">
            <button class="btn btn-ghost btn-sm" @click="closeS3Modal">取消</button>
            <button class="btn btn-primary btn-sm" @click="saveS3Config" :disabled="savingConfig">
              {{ savingConfig ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue';
import { CloudUpload, Download, Link2, Moon, Settings, Sun, X } from '@lucide/vue';
import { useSettingsStore } from '@/stores/settings';
import { useAuthStore } from '@/stores/auth';
import api from '@/api';
import { useModalFocus } from '@/composables/useModalFocus';

const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const showToast = inject<(msg: string, type: string) => void>('showToast')!;
const exporting = ref(false);

// Backup state
const backingUp = ref(false);
const showS3Modal = ref(false);
const testingConnection = ref(false);
const savingConfig = ref(false);

const s3Form = ref({
  s3Endpoint: '',
  s3Region: 'us-east-1',
  s3Bucket: '',
  s3AccessKey: '',
  s3SecretKey: '',
  s3PathPrefix: 'notes-backup',
  retentionCount: 5,
});

function closeS3Modal() {
  showS3Modal.value = false;
}

const { dialogRef } = useModalFocus(showS3Modal, closeS3Modal);

// ---- Settings handlers ----

async function updateTheme(theme: 'light' | 'dark') {
  try {
    await settingsStore.updateSettings({ theme });
  } catch {
    showToast('设置保存失败', 'error');
  }
}

async function updateFontSize(event: Event) {
  const value = parseInt((event.target as HTMLInputElement).value, 10);
  try {
    await settingsStore.updateSettings({ fontSize: value });
  } catch {
    showToast('设置保存失败', 'error');
  }
}

async function updateEditorMode(event: Event) {
  const value = (event.target as HTMLSelectElement).value as 'edit' | 'preview';
  try {
    await settingsStore.updateSettings({ defaultEditorMode: value });
  } catch {
    showToast('设置保存失败', 'error');
  }
}

async function exportData() {
  exporting.value = true;
  try {
    const response = await api.get('/export', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `notes-export-${new Date().toISOString().slice(0, 10)}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
    showToast('导出成功', 'success');
  } catch {
    showToast('导出失败', 'error');
  } finally {
    exporting.value = false;
  }
}

// ---- Backup handlers ----

async function openBackupConfig() {
  try {
    const { data } = await api.get('/admin/backup/config');
    applyBackupConfig(data);
    showS3Modal.value = true;
  } catch (e: any) {
    showToast(e.response?.data?.error || '备份配置读取失败，请检查服务连接', 'error');
  }
}

function applyBackupConfig(data: any) {
  s3Form.value = {
    s3Endpoint: data.s3Endpoint || '',
    s3Region: data.s3Region || 'us-east-1',
    s3Bucket: data.s3Bucket || '',
    s3AccessKey: data.s3AccessKey || '',
    s3SecretKey: data.s3SecretKey || '',
    s3PathPrefix: data.s3PathPrefix || 'notes-backup',
    retentionCount: data.retentionCount || 5,
  };
}

function backupConfigMatches(submitted: typeof s3Form.value, persisted: any) {
  return persisted.s3Endpoint === submitted.s3Endpoint
    && (persisted.s3Region || 'us-east-1') === (submitted.s3Region || 'us-east-1')
    && persisted.s3Bucket === submitted.s3Bucket
    && persisted.s3AccessKey === submitted.s3AccessKey
    && (persisted.s3PathPrefix || 'notes-backup') === (submitted.s3PathPrefix || 'notes-backup')
    && Number(persisted.retentionCount || 5) === Number(submitted.retentionCount || 5)
    && persisted.s3SecretKey === (submitted.s3SecretKey ? '****' : '');
}

async function saveS3Config() {
  savingConfig.value = true;
  let configWritten = false;
  try {
    const submitted = { ...s3Form.value };
    await api.put('/admin/backup/config', submitted);
    configWritten = true;
    const { data } = await api.get('/admin/backup/config');
    if (!backupConfigMatches(submitted, data)) {
      throw new Error('备份配置回读结果不一致');
    }
    applyBackupConfig(data);
    showToast('备份配置已保存', 'success');
    closeS3Modal();
  } catch (e: any) {
    const fallback = configWritten
      ? '配置已提交，但数据库回读验证失败，请重试'
      : '保存失败';
    showToast(e.response?.data?.error || e.message || fallback, 'error');
  } finally {
    savingConfig.value = false;
  }
}

async function testS3Connection() {
  testingConnection.value = true;
  try {
    const { data } = await api.post('/admin/backup/test', s3Form.value);
    showToast(data.message || '连接成功', 'success');
  } catch (e: any) {
    showToast(e.response?.data?.error || '连接测试失败', 'error');
  } finally {
    testingConnection.value = false;
  }
}

async function runBackup() {
  if (!confirm('确定要执行远程备份吗？这将把整个数据目录打包上传到 S3。')) return;
  backingUp.value = true;
  try {
    const { data } = await api.post('/admin/backup/run');
    const sizeMB = ((data.fileSize || 0) / 1024 / 1024).toFixed(2);
    showToast(`备份成功！文件: ${data.fileName}（${sizeMB} MB），远端共保留 ${data.totalBackups} 个备份`, 'success');
  } catch (e: any) {
    showToast(e.response?.data?.error || '备份失败', 'error');
  } finally {
    backingUp.value = false;
  }
}
</script>

<style scoped>
.settings-sections {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 640px;
}

.settings-card {
  padding: var(--spacing-lg);
}

.settings-section-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-light);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) 0;
  gap: var(--spacing-md);
}

.setting-item + .setting-item {
  border-top: 1px solid var(--color-border-light);
}

.setting-label {
  flex: 1;
}

.setting-name {
  display: block;
  font-weight: 500;
  font-size: var(--font-size-sm);
}

.setting-desc {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.setting-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.theme-toggle {
  display: flex;
  background: var(--color-bg-hover);
  border-radius: var(--radius-md);
  padding: 3px;
}

.theme-btn {
  padding: 6px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-secondary);
  font-family: var(--font-family);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.theme-btn.active {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  box-shadow: 0 1px 3px var(--color-shadow);
}

@media (max-width: 768px) {
  .theme-btn {
    min-height: 44px;
  }
}

.range-input {
  width: 120px;
  accent-color: var(--color-accent);
}

.select-sm {
  width: auto;
  padding: 8px 12px;
  font-size: var(--font-size-sm);
}

/* S3 Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-md);
}

.s3-modal {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.s3-modal-header {
  padding: var(--spacing-lg) var(--spacing-lg) 0;
  margin-bottom: 0;
}

.modal-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.modal-body {
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.form-row {
  display: flex;
  gap: var(--spacing-md);
}

.form-group-half {
  flex: 1;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
}

.modal-footer-right {
  display: flex;
  gap: var(--spacing-sm);
}
</style>
