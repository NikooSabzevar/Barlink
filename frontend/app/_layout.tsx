import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../store/authStore';

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f0f1a' },
          headerTintColor: '#a78bfa',
          headerTitleStyle: { fontWeight: 'bold', color: '#ffffff' },
          contentStyle: { backgroundColor: '#0f0f1a' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'BarLink', headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ title: 'Sign In' }} />
        <Stack.Screen name="(auth)/register" options={{ title: 'Create Account' }} />
        <Stack.Screen name="(patron)/explore" options={{ title: 'Explore Bars', headerShown: false }} />
        <Stack.Screen name="(patron)/bar/[id]" options={{ title: 'Bar Details' }} />
        <Stack.Screen name="(patron)/queue/[barId]" options={{ title: 'Join Queue' }} />
        <Stack.Screen name="(patron)/wait/[entryId]" options={{ title: 'Waiting Room' }} />
        <Stack.Screen name="(staff)/door" options={{ title: 'Door Mode' }} />
        <Stack.Screen name="(staff)/dashboard" options={{ title: 'Queue Dashboard' }} />
        <Stack.Screen name="(patron)/chat/[userId]" options={{ title: 'Message' }} />
        <Stack.Screen name="(patron)/profile" options={{ title: 'Chat Profile' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
