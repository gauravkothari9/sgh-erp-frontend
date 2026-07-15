// Thin wrappers around the v2 axios client — one place to find every URL.
import api from './api';

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  adminExists: () => api.get('/auth/admin-exists'),
  setupAdmin: (data) => api.post('/auth/setup-admin', data),
};

export const locationsApi = {
  list: (params) => api.get('/locations', { params }),
  get: (id) => api.get(`/locations/${id}`),
  create: (data) => api.post('/locations', data),
  update: (id, data) => api.patch(`/locations/${id}`, data),
};

export const usersApi = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`),
};

export const productsApi = {
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  create: (formData) => api.post('/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.patch(`/products/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (id) => api.delete(`/products/${id}`),
};

export const instancesApi = {
  list: (params) => api.get('/instances', { params }),
  get: (id) => api.get(`/instances/${id}`),
  byCode: (code) => api.get(`/instances/by-code/${encodeURIComponent(code)}`),
  history: (id) => api.get(`/instances/${id}/history`),
  qrUrl: (id) => `${api.defaults.baseURL}/instances/${id}/qr`,
  create: (formData) => api.post('/instances', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.patch(`/instances/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const stockApi = {
  receive: (data) => api.post('/stock/receive', data),
  transfer: (data) => api.post('/stock/transfer', data),
  balance: (params) => api.get('/stock/balance', { params }),
  ledger: (params) => api.get('/stock/ledger', { params }),
};

export const reservationsApi = {
  list: (params) => api.get('/reservations', { params }),
  create: (data) => api.post('/reservations', data),
  cancel: (id) => api.patch(`/reservations/${id}/cancel`),
  convert: (id) => api.patch(`/reservations/${id}/convert`),
};

export const salesApi = {
  list: (params) => api.get('/sales', { params }),
  create: (data) => api.post('/sales', data),
  update: (id, data) => api.patch(`/sales/${id}`, data),
  invoice: (id) => api.get(`/sales/${id}/invoice`),
};

export const reportsApi = {
  showroomSummary: () => api.get('/reports/showroom-summary'),
  aging: () => api.get('/reports/aging'),
  salesSummary: (params) => api.get('/reports/sales-summary', { params }),
  crossSearch: (params) => api.get('/reports/cross-showroom-search', { params }),
};
