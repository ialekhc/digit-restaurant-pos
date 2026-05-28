import { api } from './axios';

const unwrap = (response) => response.data?.data ?? response.data;

export const authService = {
  login: async (payload) => {
    const response = await api.post('/auth/login', payload);
    return response.data;
  },
  profile: async () => unwrap(await api.get('/auth/profile')),
  changePassword: async (payload) => unwrap(await api.put('/auth/change-password', payload))
};

export const userService = {
  list: async (params) => unwrap(await api.get('/users', { params })),
  create: async (payload) => unwrap(await api.post('/users', payload)),
  update: async (id, payload) => unwrap(await api.put(`/users/${id}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/users/${id}`))
};

export const categoryService = {
  list: async (params) => unwrap(await api.get('/categories', { params })),
  create: async (payload) => unwrap(await api.post('/categories', payload)),
  update: async (id, payload) => unwrap(await api.put(`/categories/${id}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/categories/${id}`))
};

export const menuService = {
  list: async (params) => unwrap(await api.get('/menu-items', { params })),
  get: async (id) => unwrap(await api.get(`/menu-items/${id}`)),
  importExcel: async (payload) => unwrap(await api.post('/menu-items/import', payload)),
  create: async (payload) => {
    const response = await api.post('/menu-items', payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return unwrap(response);
  },
  update: async (id, payload) => {
    const response = await api.put(`/menu-items/${id}`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return unwrap(response);
  },
  remove: async (id) => unwrap(await api.delete(`/menu-items/${id}`))
};

export const tableService = {
  list: async (params) => unwrap(await api.get('/tables', { params })),
  create: async (payload) => unwrap(await api.post('/tables', payload)),
  update: async (id, payload) => unwrap(await api.put(`/tables/${id}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/tables/${id}`)),
  updateStatus: async (id, status) => unwrap(await api.patch(`/tables/${id}/status`, { status })),
  transfer: async (fromTableId, toTableId) => unwrap(await api.patch('/tables/transfer', { fromTableId, toTableId }))
};

export const orderService = {
  list: async (params) => unwrap(await api.get('/orders', { params })),
  get: async (id) => unwrap(await api.get(`/orders/${id}`)),
  create: async (payload) => unwrap(await api.post('/orders', payload)),
  updateStatus: async (id, status, extra = {}) => unwrap(await api.patch(`/orders/${id}/status`, { status, ...extra })),
  cancel: async (id, reason) => unwrap(await api.patch(`/orders/${id}/cancel`, { reason }))
};

export const paymentService = {
  list: async (params) => unwrap(await api.get('/payments', { params })),
  create: async (payload) => unwrap(await api.post('/payments', payload)),
  get: async (id) => unwrap(await api.get(`/payments/${id}`))
};

export const inventoryService = {
  list: async (params) => unwrap(await api.get('/inventory', { params })),
  create: async (payload) => unwrap(await api.post('/inventory', payload)),
  update: async (id, payload) => unwrap(await api.put(`/inventory/${id}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/inventory/${id}`)),
  updateStock: async (id, quantity) => unwrap(await api.patch(`/inventory/${id}/stock`, { quantity }))
};

export const purchaseService = {
  list: async (params) => unwrap(await api.get('/purchases', { params })),
  create: async (payload) => unwrap(await api.post('/purchases', payload))
};

export const supplierService = {
  list: async (params) => unwrap(await api.get('/suppliers', { params })),
  create: async (payload) => unwrap(await api.post('/suppliers', payload)),
  update: async (id, payload) => unwrap(await api.put(`/suppliers/${id}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/suppliers/${id}`))
};

export const customerService = {
  list: async (params) => unwrap(await api.get('/customers', { params })),
  create: async (payload) => unwrap(await api.post('/customers', payload)),
  update: async (id, payload) => unwrap(await api.put(`/customers/${id}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/customers/${id}`)),
  orderHistory: async (id) => {
    const response = await api.get(`/customers/${id}/order-history`);
    return response.data;
  }
};

export const reportService = {
  dashboard: async () => unwrap(await api.get('/reports/dashboard')),
  dailySales: async (params) => unwrap(await api.get('/reports/daily-sales', { params })),
  weeklySales: async (params) => unwrap(await api.get('/reports/weekly-sales', { params })),
  monthlySales: async (params) => unwrap(await api.get('/reports/monthly-sales', { params })),
  yearlySales: async (params) => unwrap(await api.get('/reports/yearly-sales', { params })),
  bestSelling: async () => unwrap(await api.get('/reports/best-selling-items')),
  lowStock: async () => unwrap(await api.get('/reports/low-stock')),
  superAdmin: async () => unwrap(await api.get('/reports/super-admin'))
};

export const planService = {
  catalog: async () => unwrap(await api.get('/plans/catalog')),
  active: async () => unwrap(await api.get('/plans/active')),
  updateActive: async (payload) => unwrap(await api.put('/plans/active', payload))
};

export const vendorService = {
  list: async (params) => unwrap(await api.get('/vendors', { params })),
  get: async (id) => unwrap(await api.get(`/vendors/${id}`)),
  create: async (payload) => unwrap(await api.post('/vendors', payload)),
  update: async (id, payload) => unwrap(await api.put(`/vendors/${id}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/vendors/${id}`)),
  overview: async () => unwrap(await api.get('/vendors/overview')),
  updateSubscription: async (id, payload) => unwrap(await api.put(`/vendors/${id}/subscription`, payload)),
  addSubscriptionPayment: async (id, payload) => unwrap(await api.post(`/vendors/${id}/subscription/payments`, payload)),
  updateSubscriptionPayment: async (id, paymentId, payload) =>
    unwrap(await api.put(`/vendors/${id}/subscription/payments/${paymentId}`, payload)),
  removeSubscriptionPayment: async (id, paymentId) =>
    unwrap(await api.delete(`/vendors/${id}/subscription/payments/${paymentId}`))
};
