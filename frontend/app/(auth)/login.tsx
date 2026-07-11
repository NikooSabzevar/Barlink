import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Error', 'Please fill in all fields.');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      const user = useAuthStore.getState().user;
      if (user?.role === 'STAFF' || user?.role === 'ADMIN') {
        router.replace('/(staff)/dashboard');
      } else {
        router.replace('/(patron)/explore');
      }
    } catch (e: any) {
      Alert.alert('Login Failed', e?.response?.data?.message ?? 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Sign in to your BarLink account</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#4b5563"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#4b5563"
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.link}>
          <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkAccent}>Register</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 28, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 36 },
  form: { gap: 12 },
  label: { color: '#d1d5db', fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: '#1c1c2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  btn: {
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  link: { alignItems: 'center', marginTop: 8 },
  linkText: { color: '#6b7280', fontSize: 14 },
  linkAccent: { color: '#a78bfa', fontWeight: '600' },
});
