import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; displayName: string; phone?: string }) =>
    api.post('/auth/register', data),
};

export const barsApi = {
  list: () => api.get('/bars'),
  get: (id: string) => api.get(`/bars/${id}`),
  demographics: (id: string) => api.get(`/bars/${id}/demographics`),
  velocity: (id: string) => api.get(`/bars/${id}/velocity`),
  socialStats: (id: string) => api.get(`/bars/${id}/social-stats`),
};

export const dealsApi = {
  active: (barId: string) => api.get(`/deals/${barId}/active`),
  all: (barId: string) => api.get(`/deals/${barId}`),
  create: (barId: string, data: { title: string; description: string; startsAt: string; endsAt: string }) =>
    api.post(`/deals/${barId}`, data),
  update: (id: string, data: any) => api.patch(`/deals/${id}`, data),
  remove: (id: string) => api.delete(`/deals/${id}`),
};

export const socialApi = {
  getProfile: (userId: string) => api.get(`/social/profile/${userId}`),
  upsertProfile: (data: { photoUrl?: string; bio?: string; gender?: string; age?: number; openToChat?: boolean }) =>
    api.put('/social/profile', data),
  getLoungeUsers: (barId: string) => api.get(`/social/lounge/${barId}`),
  sendMessage: (barId: string, receiverId: string, message: string) =>
    api.post('/social/messages', { barId, receiverId, message }),
  getInbox: () => api.get('/social/messages/inbox'),
  getThread: (otherUserId: string, barId: string) =>
    api.get(`/social/messages/thread/${otherUserId}/${barId}`),
};

export const queueApi = {
  join: (barId: string, partySize: number) =>
    api.post(`/queue/${barId}/join`, { partySize }),
  state: (barId: string) => api.get(`/queue/${barId}/state`),
  myEntry: (barId: string) => api.get(`/queue/${barId}/my-entry`),
  admit: (barId: string, qrCode: string) =>
    api.post(`/queue/${barId}/admit`, { qrCode }),
  markAway: (entryId: string) => api.patch(`/queue/${entryId}/away`),
  markExit: (entryId: string) => api.patch(`/queue/${entryId}/exit`),
  override: (entryId: string, action: 'reinstate' | 'evict') =>
    api.patch(`/queue/${entryId}/override`, { action }),
  updateGps: (entryId: string, lat: number, lon: number) =>
    api.patch(`/queue/${entryId}/gps`, { lat, lon }),
};
