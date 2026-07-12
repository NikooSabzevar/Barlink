import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Switch, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { socialApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openToChat, setOpenToChat] = useState(false);
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    socialApi.getProfile(user.id)
      .then((res) => {
        const p = res.data ?? {};
        setOpenToChat(p.openToChat ?? false);
        setGender(p.gender ?? '');
        setAge(p.age ? String(p.age) : '');
        setBio(p.bio ?? '');
        setPhotoUrl(p.photoUrl ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await socialApi.upsertProfile({
        openToChat,
        gender: gender.trim().toLowerCase() || null,
        age: age.trim() ? parseInt(age.trim(), 10) : null,
        bio: bio.trim() || null,
        photoUrl: photoUrl.trim() || null,
      });
      Alert.alert('Saved', 'Your chat profile is updated.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💬 Chat Profile</Text>
        <Text style={styles.headerSub}>Control what people in the lounge see</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Open to chat</Text>
          <Switch
            value={openToChat}
            onValueChange={setOpenToChat}
            trackColor={{ false: '#374151', true: '#7c3aed' }}
            thumbColor={openToChat ? '#a78bfa' : '#9ca3af'}
          />
        </View>
        <Text style={styles.hint}>
          Turning this on lets other people inside the same bar see you in the lounge and message you.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Show in Lounge</Text>
        <Text style={styles.hint}>
          Leave a field blank to keep it hidden. For example, set only Gender to show only your gender.
        </Text>

        <Text style={styles.label}>Gender</Text>
        <TextInput
          style={styles.input}
          value={gender}
          onChangeText={setGender}
          placeholder="male, female, other..."
          placeholderTextColor="#4b5563"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.input}
          value={age}
          onChangeText={setAge}
          placeholder="25"
          placeholderTextColor="#4b5563"
          keyboardType="number-pad"
          maxLength={2}
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="A short bio..."
          placeholderTextColor="#4b5563"
          multiline
          maxLength={160}
        />

        <Text style={styles.label}>Photo URL</Text>
        <TextInput
          style={styles.input}
          value={photoUrl}
          onChangeText={setPhotoUrl}
          placeholder="https://..."
          placeholderTextColor="#4b5563"
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSub: { color: '#6b7280', fontSize: 14, marginTop: 2 },
  card: {
    marginHorizontal: 16,
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { color: '#d1d5db', fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  hint: { color: '#6b7280', fontSize: 12, lineHeight: 18 },
  input: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#374151',
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    paddingVertical: 16,
    marginHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
