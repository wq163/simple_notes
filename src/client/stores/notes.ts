import { defineStore } from 'pinia';
import api from '@/api';

export interface Category {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  noteCount: number;
}

export interface Tag {
  id: string;
  name: string;
  noteCount: number;
}

export interface NoteListItem {
  id: string;
  title: string;
  preview: string;
  categoryId: string;
  categoryName: string;
  isPinned: boolean;
  tags: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface NoteDetail {
  id: string;
  content: string;
  categoryId: string;
  isPinned: boolean;
  isDeleted: boolean;
  tags: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

interface NotesState {
  notes: NoteListItem[];
  categories: Category[];
  tags: Tag[];
  loading: boolean;
}

export const useNotesStore = defineStore('notes', {
  state: (): NotesState => ({
    notes: [],
    categories: [],
    tags: [],
    loading: false,
  }),

  getters: {
    defaultCategory: (state) => state.categories.find(c => c.isDefault),
  },

  actions: {
    async fetchCategories() {
      const { data } = await api.get('/categories');
      this.categories = data;
    },

    async fetchTags() {
      const { data } = await api.get('/tags');
      this.tags = data;
    },

    async fetchNotes(params?: { categoryId?: string; tagId?: string; search?: string; trash?: boolean }) {
      this.loading = true;
      try {
        const query: any = {};
        if (params?.categoryId) query.categoryId = params.categoryId;
        if (params?.tagId) query.tagId = params.tagId;
        if (params?.search) query.search = params.search;
        if (params?.trash) query.trash = '1';

        const { data } = await api.get('/notes', { params: query });
        this.notes = data;
      } finally {
        this.loading = false;
      }
    },

    async createNote(content: string, categoryId?: string, tagIds?: string[]) {
      const { data } = await api.post('/notes', { content, categoryId, tagIds });
      return data.id;
    },

    async getNote(id: string): Promise<NoteDetail> {
      const { data } = await api.get(`/notes/${id}`);
      return data;
    },

    async updateNote(id: string, payload: { content?: string; categoryId?: string; tagIds?: string[] }) {
      await api.put(`/notes/${id}`, payload);
    },

    async deleteNote(id: string, hard: boolean = false) {
      await api.delete(`/notes/${id}`, { params: hard ? { permanent: '1' } : {} });
      if (hard) {
        this.notes = this.notes.filter(n => n.id !== id);
      }
    },
    async emptyTrash() {
      await api.delete('/notes/empty-trash');
      this.notes = [];
    },
    async restoreNote(id: string) {
      await api.put(`/notes/${id}/restore`);
    },

    async togglePin(id: string) {
      const { data } = await api.put(`/notes/${id}/pin`);
      return data.isPinned;
    },

    async createCategory(name: string) {
      const { data } = await api.post('/categories', { name });
      this.categories.push(data);
      return data;
    },

    async updateCategory(id: string, name: string) {
      await api.put(`/categories/${id}`, { name });
      const cat = this.categories.find(c => c.id === id);
      if (cat) cat.name = name;
    },

    async deleteCategory(id: string) {
      await api.delete(`/categories/${id}`);
      this.categories = this.categories.filter(c => c.id !== id);
    },

    async createTag(name: string) {
      const { data } = await api.post('/tags', { name });
      this.tags.push(data);
      return data;
    },

    async updateTag(id: string, name: string) {
      await api.put(`/tags/${id}`, { name });
      const tag = this.tags.find(t => t.id === id);
      if (tag) tag.name = name;
    },

    async deleteTag(id: string) {
      await api.delete(`/tags/${id}`);
      this.tags = this.tags.filter(t => t.id !== id);
    },
  },
});
