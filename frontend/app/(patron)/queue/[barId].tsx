import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { barsApi, queueApi } from '../../../lib/api';

export default function JoinQueueScreen() {
  const { barId } = useLocalSearchParams<{ barId: string }>();
  const router = useRouter();
  const [bar, setBar] = useState<any>(null);
  const [partySize, setPartySize] = useState(1);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    barsApi.get(barId!).then(r => setBar(r.data)).finally(() => setLoading(false));
  }, [barId]);

  async function handleJoin() {
    if (!bar) return;
    const available = bar.maxCapacity - bar.currentCount;
    if (partySize > available && available > 0) {
      const proceed = await new Promise<boolean>((res) =>
        Alert.alert(
          'Limited Space',
          `Only ${available} spots available. Your group of ${partySize} may be skipped. Continue?`,
          [
            { text: 'Cancel', onPress: () => res(false) },
            { text: 'Join Anyway', onPress: () => res(true) },
          ]
        )
      );
      if (!proceed) return;
    }

    setJoining(true);
    try {
      const res = await queueApi.join(barId!, partySize);
      router.replace(`/(patron)/wait/${res.data.id}`);
    } catch (e: any) {
      Alert.alert('Failed to Join', e?.response?.data?.message ?? 'Please try again.');
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  const available = bar ? bar.maxCapacity - bar.currentCount : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Join Queue</Text>
      {bar && (
        <View style={styles.barInfo}>
          <Text style={styles.barName}>{bar.name}</Text>
          <Text style={styles.barStat}>{bar.currentCount}/{bar.maxCapacity} inside · {bar.queueLength} in queue</Text>
          <Text style={styles.barStat}>~{bar.estimatedWaitMins}m estimated wait</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Party Size</Text>
        <Text style={styles.sectionHint}>How many people in your group?</Text>
        <View style={styles.sizeRow}>
          <TouchableOpacity
            style={[styles.sizeBtn, partySize <= 1 && styles.sizeBtnDisabled]}
            onPress={() => setPartySize(Math.max(1, partySize - 1))}
            disabled={partySize <= 1}
          >
            <Text style={styles.sizeBtnText}>−</Text>
          </TouchableOpacity>
          <View style={styles.sizeDisplay}>
            <Text style={styles.sizeNumber}>{partySize}</Text>
            <Text style={styles.sizePeopleLabel}>{partySize === 1 ? 'person' : 'people'}</Text>
          </View>
          <TouchableOpacity
            style={[styles.sizeBtn, partySize >= 20 && styles.sizeBtnDisabled]}
            onPress={() => setPartySize(Math.min(20, partySize + 1))}
            disabled={partySize >= 20}
          >
            <Text style={styles.sizeBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {partySize > available && available > 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Only {available} spots available. Large groups may be skipped until space opens.
            </Text>
          </View>
        )}

        {available === 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⛔ Bar is currently at full capacity. You'll be queued.</Text>
          </View>
        )}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoItem}>📱 You'll receive a QR code after joining</Text>
        <Text style={styles.infoItem}>🔔 You'll be notified when you're #5 in line</Text>
        <Text style={styles.infoItem}>✅ Show QR to door staff to enter</Text>
        <Text style={styles.infoItem}>📍 GPS tracking keeps your spot while you wait</Text>
      </View>

      <TouchableOpacity
        style={[styles.joinBtn, joining && styles.joinBtnDisabled]}
        onPress={handleJoin}
        disabled={joining}
      >
        {joining ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.joinBtnText}>Confirm & Join Queue</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  barInfo: {
    backgroundColor: '#1c1c2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  barName: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  barStat: { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  section: {
    backgroundColor: '#1c1c2e',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  sectionLabel: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  sectionHint: { color: '#6b7280', fontSize: 13, marginBottom: 20 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  sizeBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeBtnDisabled: { backgroundColor: '#374151' },
  sizeBtnText: { color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 32 },
  sizeDisplay: { alignItems: 'center', minWidth: 80 },
  sizeNumber: { fontSize: 52, fontWeight: 'bold', color: '#fff', lineHeight: 60 },
  sizePeopleLabel: { color: '#6b7280', fontSize: 13 },
  warningBox: {
    backgroundColor: '#f59e0b22',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f59e0b44',
  },
  warningText: { color: '#f59e0b', fontSize: 13, lineHeight: 18 },
  infoBox: {
    backgroundColor: '#1c1c2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  infoTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
  infoItem: { color: '#9ca3af', fontSize: 13 },
  joinBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  joinBtnDisabled: { backgroundColor: '#374151' },
  joinBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
