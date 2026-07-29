import axios from 'axios';

export const DATA_REFRESH_EVENT = 'rms:data-refresh';
export const ORDERS_SYNCED_EVENT = 'rms:orders-synced';

const mutationMethods = new Set(['post', 'put', 'patch', 'delete']);
const knownOrderIds = new Set();

const notifyDataChanged = (response) => {
  if (typeof window === 'undefined') return;
  const method = response.config?.method?.toLowerCase();
  if (!mutationMethods.has(method)) return;

  window.dispatchEvent(new CustomEvent(DATA_REFRESH_EVENT, {
    detail: { method, url: response.config?.url }
  }));
};

const notifyNewOrdersSynced = (response) => {
  if (typeof window === 'undefined') return;
  if (response.config?.method?.toLowerCase() !== 'get') return;

  const requestPath = String(response.config?.url || '').split('?')[0].replace(/\/$/, '');
  if (requestPath !== '/orders') return;

  const orders = response.data?.data ?? response.data;
  if (!Array.isArray(orders)) return;

  const newOrderIds = orders
    .map((order) => String(order?._id || order?.id || ''))
    .filter((id) => id && !knownOrderIds.has(id));

  orders.forEach((order) => {
    const id = String(order?._id || order?.id || '');
    if (id) knownOrderIds.add(id);
  });

  if (newOrderIds.length) {
    window.dispatchEvent(new CustomEvent(ORDERS_SYNCED_EVENT, {
      detail: { orderIds: newOrderIds }
    }));
  }
};

const desktopApiBaseUrl = typeof window !== 'undefined' ? window.digitDesktop?.apiBaseUrl : undefined;

export const API_BASE_URL = desktopApiBaseUrl || import.meta.env.VITE_API_URL || 'http://localhost:5500/api';

export const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    notifyDataChanged(response);
    notifyNewOrdersSynced(response);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('rms_token');
      localStorage.removeItem('rms_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
