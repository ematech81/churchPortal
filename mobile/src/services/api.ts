import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

function getBaseUrl(): string {
  if (__DEV__) {
    const host = (Constants.expoConfig as any)?.hostUri?.split(':')[0];
    if (host) return `http://${host}:3000/v1`;
  }
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
}

function decodeJwtPayload(token: string): { sub?: string } | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export const api = axios.create({ baseURL: getBaseUrl() });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config as any;
    if (error.response?.status === 401 && !config._retry) {
      config._retry = true;
      const storedRefresh = await SecureStore.getItemAsync('refreshToken');
      const storedAccess = await SecureStore.getItemAsync('accessToken');
      if (storedRefresh && storedAccess) {
        const payload = decodeJwtPayload(storedAccess);
        if (payload?.sub) {
          try {
            const res = await axios.post(`${getBaseUrl()}/auth/refresh`, {
              userId: payload.sub,
              refreshToken: storedRefresh,
            });
            const { accessToken: newAccess, refreshToken: newRefresh } = res.data;
            await SecureStore.setItemAsync('accessToken', newAccess);
            await SecureStore.setItemAsync('refreshToken', newRefresh);
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${newAccess}`;
            return api(config);
          } catch {
            // refresh failed — fall through to clear tokens
          }
        }
      }
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
    }
    return Promise.reject(error);
  },
);
