import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';

const configBase = (window as any).__APP_CONFIG__?.baseUrl || '';
const apiBaseUrl = configBase === '/' ? '/api' : `${configBase}/api`;

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (config.url === '/auth/login') return config;
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function readRememberedSession(token: string) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { sessionId, exp } = JSON.parse(atob(payload));
    if (typeof sessionId === 'string' && Number.isFinite(exp)) {
      return { sessionId, exp: Number(exp) };
    }
  } catch {
    // The server validates tokens. The client only uses these fields to order renewals.
  }
}

function acceptRenewedToken(token: unknown) {
  if (typeof token !== 'string') return;
  const currentToken = localStorage.getItem('token');
  if (!currentToken) return;

  const current = readRememberedSession(currentToken);
  const renewed = readRememberedSession(token);
  if (current && renewed && current.sessionId === renewed.sessionId && renewed.exp > current.exp) {
    useAuthStore().setToken(token);
  }
}

api.interceptors.response.use(
  (response) => {
    acceptRenewedToken(response.headers['x-renewed-token']);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      const currentToken = localStorage.getItem('token');
      if (currentToken && error.config?.headers.get('Authorization') === `Bearer ${currentToken}`) {
        useAuthStore().logout();
        void router.push('/login');
      }
    } else {
      acceptRenewedToken(error.response?.headers['x-renewed-token']);
    }
    return Promise.reject(error);
  }
);

export default api;
