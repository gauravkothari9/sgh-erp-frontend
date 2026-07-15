// v2 API client — talks to /api/v2/* (MongoDB-backed modules).
// Adds auto-refresh on 401.

import axios from 'axios';
import { useAuthV2 } from '../stores/authStore';

const BASE = (import.meta.env.VITE_API_BASE_URL || '/api') + '/v2';

const api = axios.create({ baseURL: BASE, withCredentials: false });

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthV2.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshInFlight = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { response, config } = error;
    if (response?.status !== 401 || config?._retry) throw error;

    const { refreshToken, setTokens, logout } = useAuthV2.getState();
    if (!refreshToken) {
      logout();
      throw error;
    }
    refreshInFlight ||= axios
      .post(`${BASE}/auth/refresh`, { refreshToken })
      .then((res) => {
        setTokens(res.data.data.accessToken, res.data.data.refreshToken, res.data.data.user);
        return res.data.data.accessToken;
      })
      .catch((e) => {
        logout();
        throw e;
      })
      .finally(() => {
        refreshInFlight = null;
      });

    const fresh = await refreshInFlight;
    config._retry = true;
    config.headers.Authorization = `Bearer ${fresh}`;
    return api.request(config);
  }
);

export default api;
