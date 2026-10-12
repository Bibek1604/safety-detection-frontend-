import axios from 'axios';

// Single source of the API base URL. VITE_API_URL may be a full backend URL
// (with or without a trailing /api); blank means same origin / the Vite dev proxy.
export const API_BASE_URL = (() => {
  const url = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!url) return '/api';
  return url.endsWith('/api') ? url : `${url}/api`;
})();

const client = axios.create({ baseURL: API_BASE_URL, timeout: 60000 });

client.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      // Auth endpoints returning 401 mean the credentials were wrong —
      // NOT an expired session. Let the error propagate to the component's
      // catch block so the user sees the specific reason without a reload.
      const url = err.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/signup');
      if (!isAuthEndpoint) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default client;
