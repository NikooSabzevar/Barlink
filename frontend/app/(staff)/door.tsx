import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, ActivityIndicator, TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuthStore } from '../../store/authStore';
import { queueApi, barsApi } from '../../lib/api';

export default function DoorModeScreen() {
  const user = useAuthStore((s) => s.user);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [bar, setBar] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualQr, setManualQr] = useState('');
  const [barId, setBarId] = useState('bar-001');

  useEffect(() => {
    loadBar();
  }, [barId]);

  async function loadBar() {
    try {
      const [barRes, queueRes] = await Promise.all([
        barsApi.get(barId),
        queueApi.state(barId),
      ]);
      setBar(barRes.data);
      setQueue(queueRes.data);
    } catch {}
  }

  async function admitByQr(qrCode: string) {
    if (!qrCode.trim()) return;
    setLoading(true);
    try {
      await queueApi.admit(barId, qrCode.trim());
      Alert.alert('✅ Admitted', 'Patron has been checked in successfully.');
      setManualQr('');
      setScanned(false);
      loadBar();
    } catch (e: any) {
      Alert.alert('❌ Scan Failed', e?.response?.data?.message ?? 'QR code not recognized.');
      setScanned(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleOverride(entryId: string, action: 'reinstate' | 'evict') {
    Alert.alert(
      action === 'reinstate' ? 'Reinstate Patron' : 'Evict Patron',
      `Are you sure you want to ${action} this patron?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: action === 'evict' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await queueApi.override(entryId, action);
              Alert.alert('Done', `Patron ${action}d successfully.`);
              loadBar();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message);
            }
          },
        },
      ]
    );
  }

  const occupancyPct = bar ? Math.round((bar.currentCount / bar.maxCapacity) * 100) : 0;
  const statusColor = occupancyPct >= 90 ? '#ef4444' : occupancyPct >= 70 ? '#f59e0b' : '#10b981';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚪 Door Mode</Text>
        <Text style={styles.headerSub}>Staff: {user?.displayName}</Text>
      </View>

      {bar && (
        <View style={styles.capacityCard}>
          <Text style={styles.barName}>{bar.name}</Text>
          <View style={styles.capacityRow}>
            <Text style={[styles.capacityNum, { color: statusColor }]}>{bar.currentCount}</Text>
            <Text style={styles.capacitySlash}> / </Text>
            <Text style={styles.capacityMax}>{bar.maxCapacity}</Text>
          </View>
          <View style={styles.occTrack}>
            <View style={[styles.occFill, { width: `${Math.min(occupancyPct, 100)}%` as any, backgroundColor: statusColor }]} />
          </View>
          <Text style={styles.capacityLabel}>{occupancyPct}% capacity · {queue.length} in queue</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scan QR Code</Text>
        {!scanning ? (
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={async () => {
              if (!permission?.granted) await requestPermission();
              setScanning(true);
              setScanned(false);
            }}
          >
            <Text style={styles.scanBtnText}>📷 Open Camera Scanner</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={scanned ? undefined : ({ data }) => {
                setScanned(true);
                setScanning(false);
                admitByQr(data);
              }}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
            <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setScanning(false)}>
              <Text style={styles.cancelScanText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.orDivider}>— or enter manually —</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            value={manualQr}
            onChangeText={setManualQr}
            placeholder="Paste QR code value..."
            placeholderTextColor="#4b5563"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.admitBtn}
            onPress={() => admitByQr(manualQr)}
            disabled={loading || !manualQr.trim()}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.admitBtnText}>Admit</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Live Queue ({queue.length})</Text>
          <TouchableOpacity onPress={loadBar}>
            <Text style={styles.refreshText}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>
        {queue.length === 0 ? (
          <Text style={styles.emptyText}>Queue is empty</Text>
        ) : (
          queue.slice(0, 20).map((entry: any, idx: number) => (
            <View key={entry.id} style={styles.entryRow}>
              <View style={styles.entryLeft}>
                <Text style={styles.entryPos}>#{idx + 1}</Text>
                <View>
                  <Text style={styles.entryName}>{entry.userId?.slice(0, 8) ?? 'Patron'}...</Text>
                  <Text style={styles.entrySub}>Party of {entry.partySize} · {entry.status}</Text>
                </View>
              </View>
              <View style={styles.entryActions}>
                <TouchableOpacity
                  style={styles.reinstateBtn}
                  onPress={() => handleOverride(entry.id, 'reinstate')}
                >
                  <Text style={styles.reinstateBtnText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.evictBtn}
                  onPress={() => handleOverride(entry.id, 'evict')}
                >
                  <Text style={styles.evictBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSub: { color: '#6b7280', fontSize: 14, marginTop: 2 },
  capacityCard: {
    marginHorizontal: 16,
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
    alignItems: 'center',
  },
  barName: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  capacityRow: { flexDirection: 'row', alignItems: 'baseline' },
  capacityNum: { fontSize: 56, fontWeight: 'bold' },
  capacitySlash: { fontSize: 32, color: '#4b5563' },
  capacityMax: { fontSize: 32, color: '#6b7280', fontWeight: 'bold' },
  occTrack: { height: 8, backgroundColor: '#374151', borderRadius: 4, width: '100%', marginVertical: 10, overflow: 'hidden' },
  occFill: { height: '100%', borderRadius: 4 },
  capacityLabel: { color: '#6b7280', fontSize: 13 },
  section: {
    marginHorizontal: 16,
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  refreshText: { color: '#a78bfa', fontSize: 14 },
  scanBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cameraContainer: { height: 280, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  camera: { flex: 1 },
  cancelScanBtn: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: '#0f0f1a99',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  cancelScanText: { color: '#fff', fontSize: 14 },
  orDivider: { color: '#4b5563', textAlign: 'center', fontSize: 13, marginVertical: 12 },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  admitBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 64,
  },
  admitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  emptyText: { color: '#4b5563', textAlign: 'center', paddingVertical: 20, fontSize: 14 },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  entryLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryPos: { color: '#a78bfa', fontSize: 18, fontWeight: 'bold', width: 32 },
  entryName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  entrySub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  entryActions: { flexDirection: 'row', gap: 8 },
  reinstateBtn: {
    backgroundColor: '#10b98122',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  reinstateBtnText: { color: '#10b981', fontWeight: 'bold', fontSize: 16 },
  evictBtn: {
    backgroundColor: '#ef444422',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  evictBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
});
