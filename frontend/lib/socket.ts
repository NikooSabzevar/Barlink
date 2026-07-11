import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem('access_token');

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function subscribeToBar(barId: string, onUpdate: (data: any) => void) {
  socket?.emit('join-bar-room', { barId });
  socket?.on('queue-update', onUpdate);
  socket?.on('capacity-update', onUpdate);
}

export function subscribeToEntry(entryId: string, callbacks: {
  onPosition?: (data: any) => void;
  onEviction?: (data: any) => void;
  onAway?: (data: any) => void;
}) {
  socket?.emit('subscribe-entry', { entryId });
  if (callbacks.onPosition) socket?.on('position-update', callbacks.onPosition);
  if (callbacks.onEviction) socket?.on('eviction-warning', callbacks.onEviction);
  if (callbacks.onAway) socket?.on('away-comeback', callbacks.onAway);
}

export function unsubscribeFromBar(barId: string) {
  socket?.emit('leave-bar-room', { barId });
  socket?.off('queue-update');
  socket?.off('capacity-update');
}

export function subscribeToUserRoom(
  userId: string,
  callbacks: {
    onMessage?: (data: any) => void;
    onChatBlocked?: (data: any) => void;
  },
) {
  socket?.emit('join-user-room', { userId });
  if (callbacks.onMessage) socket?.on('chat-message', callbacks.onMessage);
  if (callbacks.onChatBlocked) socket?.on('chat-blocked', callbacks.onChatBlocked);
}

export function unsubscribeChat() {
  socket?.off('chat-message');
  socket?.off('chat-blocked');
}
