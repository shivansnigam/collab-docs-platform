// src/services/api.js
import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "./auth.service";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(
  (cfg) => {
    const token = getAccessToken();
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  },
  (err) => Promise.reject(err)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, tokens) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(tokens)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest || originalRequest._retry)
      return Promise.reject(error);

    if (error.response && error.response.status === 401) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((tokens) => {
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const resp = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });
        const { accessToken, refreshToken: newRefresh } = resp.data;
        // keep user if exists
        const user = JSON.parse(localStorage.getItem("app_user") || "null");
        setTokens(accessToken, newRefresh, user);
        processQueue(null, { accessToken, refreshToken: newRefresh });
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        clearTokens();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const fetchMyNotifications = () => api.get("/notifications");
export const markNotificationAsRead = (id) =>
  api.post(`/notifications/${id}/read`);

export default api;
