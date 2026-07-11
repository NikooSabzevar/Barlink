import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../lib/api';

interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'PATRON' | 'STAFF' | 'ADMIN';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  hydrate: async () => {
    const token = await AsyncStorage.getItem('access_token');
    const userRaw = await AsyncStorage.getItem('user');
    if (token && userRaw) {
      set({ token, user: JSON.parse(userRaw), isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const res = await authApi.login(email, password);
    const { access_token, user } = res.data;
    await AsyncStorage.setItem('access_token', access_token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ token: access_token, user });
  },

  register: async (data) => {
    const res = await authApi.register(data);
    const { access_token, user } = res.data;
    await AsyncStorage.setItem('access_token', access_token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ token: access_token, user });
  },

  logout: async () => {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('user');
    set({ token: null, user: null });
  },
}));
