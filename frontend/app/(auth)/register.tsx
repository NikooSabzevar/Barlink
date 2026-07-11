import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!displayName || !email || !password) return Alert.alert('Error', 'Please fill in all fields.');
    if (password.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters.');
    setLoading(true);
    try {
      await register({ displayName, email: email.trim().toLowerCase(), password });
      router.replace('/(patron)/explore');
    } catch (e: any) {
      Alert.alert('Registration Failed', e?.response?.data?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join BarLink and skip the line</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor="#4b5563"
        />

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
          placeholder="Min. 6 characters"
          placeholderTextColor="#4b5563"
        />

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.link}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.linkAccent}>Sign In</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0f0f1a' },
  container: { padding: 28, justifyContent: 'center', flexGrow: 1 },
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
