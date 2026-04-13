import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';

const configBase = (window as any).__APP_CONFIG__?.baseUrl || '';
const apiBaseUrl = configBase === '/' ? '/api' : `${configBase}/api`;

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
});

// Request interceptor: add token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      authStore.logout();
      router.push('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
