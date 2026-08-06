import axios from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ─── Request interceptor: attach JWT ────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const stored = localStorage.getItem('sgh-erp-auth');
    if (stored) {
      const { state } = JSON.parse(stored);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor: handle errors ────────────────────────────────────
//
// Builds the most specific message we can from the server response so users
// always see WHICH field/value didn't match — never a generic "Validation
// failed". Order of preference:
//   1. Explicit `message` from the server
//   2. Joined `errors[].field: message` list (Zod / express-validator shape)
//   3. Native axios `error.message`
//   4. Hard-coded fallback
const extractErrorMessage = (error) => {
  const data = error.response?.data;
  if (data) {
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (data.message) return data.message;
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e) => (e.field ? `${e.field}: ${e.message || e}` : e.message || e))
        .join(' · ');
    }
    if (data.error) return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
  }
  return error.message || 'Something went wrong. Please try again.';
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = extractErrorMessage(error);

    if (error.response?.status === 401) {
      localStorage.removeItem('sgh-erp-auth');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // 409 = duplicate (handled at the call site to show a richer dialog).
    // Cancelled requests aren't real errors and shouldn't toast either.
    if (error.response?.status !== 409 && error.code !== 'ERR_CANCELED') {
      toast.error(message);
    }

    // Stash the resolved message so callers don't have to re-derive it.
    error.toastMessage = message;
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getBootstrapStatus: () => api.get('/auth/bootstrap-status'),
  bootstrapAdmin: (data) => api.post('/auth/bootstrap-admin', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data), // self-service profile edit
  updatePassword: (data) => api.put('/auth/update-password', data),
  getModules: () => api.get('/auth/modules'),

  // Admin: user management
  getUsers: () => api.get('/auth/users'),
  getUser: (id) => api.get(`/auth/users/${id}`),
  createUser: (data) => api.post('/auth/users', data),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  updateUserPermissions: (id, permissions) =>
    api.put(`/auth/users/${id}/permissions`, { permissions }),
  resetUserPassword: (id, newPassword) =>
    api.post(`/auth/users/${id}/reset-password`, { newPassword }),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
};

// ─── Customers ───────────────────────────────────────────────────────────────
export const customerAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  getByFileNumber: (fileNumber) => api.get(`/customers/file/${fileNumber}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  updateStatus: (id, status) => api.patch(`/customers/${id}/status`, { status }),
  delete: (id) => api.delete(`/customers/${id}`),
  getStats: () => api.get('/customers/stats/summary'),
  uploadPhoto: (id, formData) =>
    api.post(`/customers/${id}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const orderAPI = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  cancel: (id, reason) => api.patch(`/orders/${id}/cancel`, { reason }),
  finalize: (id, data) => api.patch(`/orders/${id}/finalize`, data),
  startProcessing: (id) => api.patch(`/orders/${id}/start-processing`),
  addComment: (id, formData) =>
    api.post(`/orders/${id}/comments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  uploadMedia: (formData) =>
    api.post('/orders/upload-media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  renameMedia: (data) => api.post('/orders/rename-media', data),
  uploadImages: (id, formData) =>
    api.post(`/orders/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  uploadAttachment: (id, formData) =>
    api.post(`/orders/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getDashboardStats: () => api.get('/orders/stats/dashboard'),
  export: (params) => api.get('/orders/export', { params }),
  delete: (id) => api.delete('/orders/' + id),
  deleteMedia: (id, data) => api.delete(`/orders/${id}/media`, { data }),
  setPrimaryImage: (id, itemId, payload) => api.patch(`/orders/${id}/items/${itemId}/primary-image`, payload),
};

// ─── Production (Factory / Branches) ──────────────────────────────────────────
export const productionAPI = {
  getConfig: () => api.get('/orders/production/config'),
  // getBoard powers the Kanban board AND every branch/stage view. Params:
  // { branch, category, sourcing, stage, location, needsSetup, search, fileNumber }.
  getBoard: (params) => api.get('/orders/production/board', { params }),
  // Route an item (branch → category/sourcing → maker/outsource) or patch its
  // outsource details. Same endpoint.
  setItemProduction: (orderId, itemId, data) =>
    api.patch(`/orders/${orderId}/items/${itemId}/production`, data),
  advanceStage: (orderId, itemId, data) =>
    api.patch(`/orders/${orderId}/items/${itemId}/stage`, data),
  // Bulk flags (priority / running) for a whole order or a whole file.
  setOrderFlags: (orderId, data) => api.patch(`/orders/${orderId}/flags`, data),
  setFileFlags: (fileNumber, data) => api.patch(`/orders/file/${encodeURIComponent(fileNumber)}/flags`, data),
};

// ─── Container ────────────────────────────────────────────────────────────────
export const containerAPI = {
  // Per-file container completion (ready vs total pieces).
  getProgress: (params) => api.get('/orders/container/progress', { params }),
  // Drill-down: a file's orders + items with stage distribution.
  getFile: (fileNumber) => api.get(`/orders/container/file/${encodeURIComponent(fileNumber)}`),
  // Mark an order Completed (only when every piece is Ready for Container).
  completeOrder: (orderId) => api.patch(`/orders/${orderId}/complete`),
};

// ─── Showroom ─────────────────────────────────────────────────────────────────
export const showroomAPI = {
  list: (params) => api.get('/showroom/products', { params }),
  getById: (id) => api.get(`/showroom/products/${id}`),
  getCollections: (params) => api.get('/showroom/collections', { params }),
  getCollectionProducts: (params) => api.get('/showroom/collections/products', { params }),
  create: (formData) => api.post('/showroom/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, formData) => api.put(`/showroom/products/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  transfer: (id, data) => api.patch(`/showroom/products/${id}/transfer`, data),
  // Rotate the saved photo 90° — direction: 'cw' | 'ccw'. Turns the actual
  // pixels and keeps the same URL, so it shows rotated everywhere at once.
  rotateImage: (id, direction) => api.patch(`/showroom/products/${id}/rotate-image`, { direction }),
  consume: (data) => api.post('/showroom/products/consume', data),
  remove: (id) => api.delete(`/showroom/products/${id}`),
};

// ─── Settings (singleton) ─────────────────────────────────────────────────────
export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
// One call; the server returns only the sections this user's modules cover.
export const dashboardAPI = {
  get: () => api.get('/dashboard'),
};

// ─── Local customers (walk-in) ────────────────────────────────────────────────
export const localCustomerAPI = {
  getAll: (params) => api.get('/local/customers', { params }),
  getById: (id) => api.get(`/local/customers/${id}`), // includes purchase history
  create: (data) => api.post('/local/customers', data),
  update: (id, data) => api.put(`/local/customers/${id}`, data),
  remove: (id) => api.delete(`/local/customers/${id}`),
};

// ─── Local orders (showroom floor sales) ──────────────────────────────────────
export const localSaleAPI = {
  getAll: (params) => api.get('/local/sales', { params }),
  getById: (id) => api.get(`/local/sales/${id}`),
  create: (data) => api.post('/local/sales', data),
  updatePayment: (id, data) => api.patch(`/local/sales/${id}/payment`, data),
  returnItems: (id, data) => api.post(`/local/sales/${id}/return`, data),
  remove: (id) => api.delete(`/local/sales/${id}`),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationAPI = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

// ─── Buyer Catalogue ──────────────────────────────────────────────────────────
export const buyerCatalogueAPI = {
  getFolders: (params) => api.get('/buyer-catalogue', { params }),
  getDetail: (fileNumber, params) => api.get(`/buyer-catalogue/${encodeURIComponent(fileNumber)}`, { params }),
  getSkuLookup: (fileNumber, sku) => api.get(`/buyer-catalogue/${encodeURIComponent(fileNumber)}/sku/${encodeURIComponent(sku)}`),
};

export default api;
