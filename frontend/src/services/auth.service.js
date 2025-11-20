const ACCESS_KEY = "app_access_token";
const REFRESH_KEY = "app_refresh_token";
const USER_KEY = "app_user";

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
export const getUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
};

export const setTokens = (accessToken, refreshToken, user) => {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
};
