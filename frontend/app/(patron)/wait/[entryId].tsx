import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';
import { queueApi } from '../../../lib/api';
import { getSocket, subscribeToEntry } from '../../../lib/socket';

const STATUS_LABELS: Record<string, string> = {
  WAITING: '⏳ Waiting in Queue',
  NOTIFIED: '🔔 Get Ready — You\'re Almost Up!',
  INSIDE: '🎉 You\'re Inside!',
  AWAY: '🚶 Temporarily Away',
  EXITED: '👋 You\'ve Left',
  EVICTED: '⚠️ Spot Released',
};

const STATUS_COLORS: Record<string, string> = {
  WAITING: '#6b7280',
  NOTIFIED: '#f59e0b',
  INSIDE: '#10b981',
  AWAY: '#3b82f6',
  EXITED: '#9ca3af',
  EVICTED: '#ef4444',
};

export default function WaitScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<any>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const gpsInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchEntry();
    setupSocket();
    startGpsPing();
    return () => {
      if (gpsInterval.current) clearInterval(gpsInterval.current);
    };
  }, [entryId]);

  async function fetchEntry() {
    try {
      const res = await queueApi.myEntry('');
      if (res.data) setEntry(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function setupSocket() {
    await getSocket();
    subscribeToEntry(entryId!, {
      onPosition: (data) => setPosition(data.position),
      onEviction: (data) => Alert.alert('⚠️ Heads Up!', data.message),
      onAway: (data) => {
        Alert.alert(
          'Are you coming back?',
          data.message,
          [
            { text: 'Yes, coming back!', onPress: () => handleComeBack() },
            { text: 'No, I\'m leaving', onPress: () => handleExit() },
          ]
        );
      },
    });
  }

  async function startGpsPing() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    gpsInterval.current = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await queueApi.updateGps(entryId!, loc.coords.latitude, loc.coords.longitude);
      } catch {}
    }, 60_000);
  }

  async function handleComeBack() {
    Alert.alert('👍 Great!', 'You have 10 minutes to return to the bar.');
  }

  async function handleExit() {
    try {
      await queueApi.markExit(entryId!);
      router.replace('/(patron)/explore');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to exit.');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  const status = entry?.status ?? 'WAITING';
  const statusColor = STATUS_COLORS[status] ?? '#6b7280';
  const pos = position ?? entry?.position;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.statusCard, { borderColor: statusColor + '66' }]}>
        <Text style={[styles.statusLabel, { color: statusColor }]}>{STATUS_LABELS[status]}</Text>
        {pos && status === 'WAITING' && (
          <View style={styles.positionBadge}>
            <Text style={styles.positionNum}>#{pos}</Text>
            <Text style={styles.positionSub}>in queue</Text>
          </View>
        )}
      </View>

      {entry?.qrCode && (
        <View style={styles.qrSection}>
          <Text style={styles.qrLabel}>Your QR Code</Text>
          <Text style={styles.qrHint}>Show this to door staff when you arrive</Text>
          <View style={styles.qrBox}>
            <QRCode value={entry.qrCode} size={200} backgroundColor="#1c1c2e" color="#ffffff" />
          </View>
        </View>
      )}

      <View style={styles.infoBox}>
        <InfoRow label="Party Size" value={`${entry?.partySize ?? '—'} people`} />
        <InfoRow label="Joined At" value={entry?.joinedAt ? new Date(entry.joinedAt).toLocaleTimeString() : '—'} />
        {entry?.admittedAt && (
          <InfoRow label="Admitted At" value={new Date(entry.admittedAt).toLocaleTimeString()} />
        )}
      </View>

      {(status === 'WAITING' || status === 'NOTIFIED') && (
        <TouchableOpacity style={styles.exitBtn} onPress={() => Alert.alert(
          'Leave Queue',
          'Are you sure you want to leave the queue?',
          [
            { text: 'Stay', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: handleExit },
          ]
        )}>
          <Text style={styles.exitBtnText}>Leave Queue</Text>
        </TouchableOpacity>
      )}

      {status === 'INSIDE' && (
        <TouchableOpacity style={styles.awayBtn} onPress={async () => {
          try {
            await queueApi.markAway(entryId!);
            Alert.alert('Away Mode', '15-min grace period started. Return within 30 mins total.');
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message);
          }
        }}>
          <Text style={styles.awayBtnText}>Step Out Temporarily</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  statusCard: {
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
  },
  statusLabel: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  positionBadge: { marginTop: 16, alignItems: 'center' },
  positionNum: { fontSize: 72, fontWeight: 'bold', color: '#a78bfa', lineHeight: 80 },
  positionSub: { color: '#6b7280', fontSize: 16, marginTop: -4 },
  qrSection: {
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  qrLabel: { fontSize: 17, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  qrHint: { color: '#6b7280', fontSize: 13, marginBottom: 16, textAlign: 'center' },
  qrBox: {
    backgroundColor: '#1c1c2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  infoBox: {
    backgroundColor: '#1c1c2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
    gap: 12,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { color: '#6b7280', fontSize: 14 },
  infoValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  exitBtn: {
    backgroundColor: '#1c1c2e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
    marginBottom: 12,
  },
  exitBtnText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
  awayBtn: {
    backgroundColor: '#3b82f622',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginBottom: 12,
  },
  awayBtnText: { color: '#3b82f6', fontSize: 16, fontWeight: 'bold' },
});
