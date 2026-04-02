import axios from 'axios';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();

const normalizedApiBase = (() => {
  if (!rawApiUrl) return '/api';

  let normalizedInput = rawApiUrl;
  const inputHasProtocol = /^https?:\/\//i.test(normalizedInput);
  if (!inputHasProtocol) {
    const hostPart = normalizedInput.split('/')[0];
    const isBareRenderSlug = hostPart && !hostPart.includes('.') && hostPart !== 'localhost' && !hostPart.includes(':');
    if (isBareRenderSlug) {
      normalizedInput = normalizedInput.replace(hostPart, `${hostPart}.onrender.com`);
    }
  }

  const withProtocol = normalizedInput.startsWith('http://') || normalizedInput.startsWith('https://')
    ? normalizedInput
    : `https://${normalizedInput}`;

  const withoutTrailingSlash = withProtocol.replace(/\/$/, '');
  return /\/api$/i.test(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
})();

const api = axios.create({ baseURL: normalizedApiBase });

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
