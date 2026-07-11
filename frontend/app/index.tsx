import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function IndexScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'STAFF' || user.role === 'ADMIN') {
        router.replace('/(staff)/dashboard');
      } else {
        router.replace('/(patron)/explore');
      }
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>🍺</Text>
        <Text style={styles.title}>BarLink</Text>
        <Text style={styles.subtitle}>Real-time Bar Queue & Live Demographics</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.secondaryBtnText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.guestBtn}
          onPress={() => router.push('/(patron)/explore')}
        >
          <Text style={styles.guestBtnText}>Browse Bars as Guest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  container: { flex: 1, backgroundColor: '#0f0f1a', justifyContent: 'space-between', padding: 32 },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 80, marginBottom: 16 },
  title: { fontSize: 48, fontWeight: 'bold', color: '#ffffff', letterSpacing: 2 },
  subtitle: { fontSize: 16, color: '#a78bfa', marginTop: 8, textAlign: 'center' },
  buttons: { gap: 12 },
  primaryBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#7c3aed',
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#a78bfa', fontSize: 18, fontWeight: 'bold' },
  guestBtn: { paddingVertical: 12, alignItems: 'center' },
  guestBtnText: { color: '#6b7280', fontSize: 14 },
});
