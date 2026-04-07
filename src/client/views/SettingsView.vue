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
              @click="updateTheme('light')"
            >☀️ 浅色</button>
            <button
              class="theme-btn" :class="{ active: settingsStore.theme === 'dark' }"
              @click="updateTheme('dark')"
            >🌙 深色</button>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">字体大小</span>
            <span class="setting-desc">{{ settingsStore.fontSize }}px</span>
          </div>
          <input
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
            {{ exporting ? '导出中...' : '📦 导出' }}
          </button>
        </div>

        <!-- Remote Backup (Admin Only) -->
        <div v-if="authStore.isAdmin" class="setting-item">
          <div class="setting-label">
            <span class="setting-name">远程备份</span>
            <span class="setting-desc">将整个数据目录备份到 S3 兼容对象存储</span>
          </div>
          <div class="setting-actions">
            <button class="btn btn-ghost btn-sm" @click="openBackupConfig">⚙️ 配置</button>
            <button class="btn btn-primary btn-sm" @click="runBackup" :disabled="backingUp">
              {{ backingUp ? '备份中...' : '☁️ 备份' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- S3 Config Modal -->
    <div v-if="showS3Modal" class="modal-overlay" @click.self="showS3Modal = false">
      <div class="modal-content s3-modal">
        <h3 class="modal-title">S3 备份配置</h3>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">S3 Endpoint</label>
            <input v-model="s3Form.s3Endpoint" class="form-input" placeholder="https://s3.amazonaws.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Region</label>
            <input v-model="s3Form.s3Region" class="form-input" placeholder="us-east-1" />
          </div>
          <div class="form-group">
            <label class="form-label">Bucket</label>
            <input v-model="s3Form.s3Bucket" class="form-input" placeholder="my-notes-backup" />
          </div>
          <div class="form-group">
            <label class="form-label">Access Key</label>
            <input v-model="s3Form.s3AccessKey" class="form-input" placeholder="AKIAIOSFODNN7EXAMPLE" />
          </div>
          <div class="form-group">
            <label class="form-label">Secret Key</label>
            <input v-model="s3Form.s3SecretKey" type="password" class="form-input" placeholder="输入新密钥或保留 ****" />
          </div>
          <div class="form-row">
            <div class="form-group form-group-half">
              <label class="form-label">路径前缀</label>
              <input v-model="s3Form.s3PathPrefix" class="form-input" placeholder="notes-backup" />
            </div>
            <div class="form-group form-group-half">
              <label class="form-label">保留数量</label>
              <input v-model.number="s3Form.retentionCount" type="number" min="1" max="100" class="form-input" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost btn-sm" @click="testS3Connection" :disabled="testingConnection">
            {{ testingConnection ? '测试中...' : '🔗 测试连接' }}
          </button>
          <div class="modal-footer-right">
            <button class="btn btn-ghost btn-sm" @click="showS3Modal = false">取消</button>
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
import { useSettingsStore } from '@/stores/settings';
import { useAuthStore } from '@/stores/auth';
import api from '@/api';

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
    s3Form.value = {
      s3Endpoint: data.s3Endpoint || '',
      s3Region: data.s3Region || 'us-east-1',
      s3Bucket: data.s3Bucket || '',
      s3AccessKey: data.s3AccessKey || '',
      s3SecretKey: data.s3SecretKey || '',
      s3PathPrefix: data.s3PathPrefix || 'notes-backup',
      retentionCount: data.retentionCount || 5,
    };
  } catch {
    // Use defaults if config not loaded
  }
  showS3Modal.value = true;
}

async function saveS3Config() {
  savingConfig.value = true;
  try {
    await api.put('/admin/backup/config', s3Form.value);
    showToast('备份配置已保存', 'success');
    showS3Modal.value = false;
  } catch (e: any) {
    showToast(e.response?.data?.error || '保存失败', 'error');
  } finally {
    savingConfig.value = false;
  }
}

async function testS3Connection() {
  testingConnection.value = true;
  try {
    // Save first, then test
    await api.put('/admin/backup/config', s3Form.value);
    const { data } = await api.post('/admin/backup/test');
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
}

.theme-btn.active {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  box-shadow: 0 1px 3px var(--color-shadow);
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

.modal-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  padding: var(--spacing-lg) var(--spacing-lg) 0;
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
