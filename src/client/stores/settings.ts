import { defineStore } from 'pinia';
import api from '@/api';

interface SettingsState {
  theme: 'light' | 'dark';
  fontSize: number;
  defaultEditorMode: 'edit' | 'preview';
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
    fontSize: parseInt(localStorage.getItem('fontSize') || '16', 10),
    defaultEditorMode: (localStorage.getItem('defaultEditorMode') as 'edit' | 'preview') || 'edit',
  }),

  actions: {
    async fetchSettings() {
      try {
        const { data } = await api.get('/settings');
        this.theme = data.theme;
        this.fontSize = data.fontSize;
        this.defaultEditorMode = data.defaultEditorMode;
        this.applyTheme();
        localStorage.setItem('theme', this.theme);
        localStorage.setItem('fontSize', String(this.fontSize));
        localStorage.setItem('defaultEditorMode', this.defaultEditorMode);
      } catch { /* use defaults */ }
    },

    async updateSettings(settings: Partial<SettingsState>) {
      await api.put('/settings', settings);
      if (settings.theme !== undefined) {
        this.theme = settings.theme;
        localStorage.setItem('theme', settings.theme);
      }
      if (settings.fontSize !== undefined) {
        this.fontSize = settings.fontSize;
        localStorage.setItem('fontSize', String(settings.fontSize));
      }
      if (settings.defaultEditorMode !== undefined) {
        this.defaultEditorMode = settings.defaultEditorMode;
        localStorage.setItem('defaultEditorMode', settings.defaultEditorMode);
      }
      this.applyTheme();
    },

    applyTheme() {
      document.documentElement.setAttribute('data-theme', this.theme);
      document.documentElement.style.setProperty('--font-size-base', `${this.fontSize}px`);
    },
  },
});
