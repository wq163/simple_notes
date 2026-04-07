import { defineStore } from 'pinia';
import api from '@/api';

interface User {
  id: string;
  username: string;
  displayName: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === 'admin',
  },

  actions: {
    async login(username: string, password: string, rememberMe: boolean = false) {
      const { data } = await api.post('/auth/login', { username, password, rememberMe });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    },

    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },

    async fetchProfile() {
      const { data } = await api.get('/users/me');
      this.user = data;
      localStorage.setItem('user', JSON.stringify(data));
    },
  },
});
