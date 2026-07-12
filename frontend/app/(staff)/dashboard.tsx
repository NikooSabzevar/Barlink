import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { barsApi, queueApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { getSocket, subscribeToBar } from '../../lib/socket';

const BAR_ID = 'bar-001';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [bar, setBar] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [velocity, setVelocity] = useState<number>(0);
  const [socialStats, setSocialStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [barRes, queueRes, velRes, statsRes] = await Promise.all([
        barsApi.get(BAR_ID),
        queueApi.state(BAR_ID),
        barsApi.velocity(BAR_ID),
        barsApi.socialStats(BAR_ID).catch(() => ({ data: null })),
      ]);
      setBar(barRes.data);
      setQueue(queueRes.data);
      setVelocity(velRes.data);
      setSocialStats(statsRes.data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    setupSocket();
  }, [fetchAll]);

  async function setupSocket() {
    const socket = await getSocket();
    subscribeToBar(BAR_ID, () => fetchAll());
  }

  async function handleSimulateCheckIn() {
    setSimulating(true);
    try {
      await queueApi.simulateCheckIn(BAR_ID);
      Alert.alert('✅ Simulated', 'Random patron checked in.');
      fetchAll();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to simulate check-in.');
    } finally {
      setSimulating(false);
    }
  }

  const occupancyPct = bar ? Math.round((bar.currentCount / bar.maxCapacity) * 100) : 0;
  const statusColor = occupancyPct >= 90 ? '#ef4444' : occupancyPct >= 70 ? '#f59e0b' : '#10b981';

  const waitingCount = queue.filter((e) => e?.status === 'WAITING').length;
  const notifiedCount = queue.filter((e) => e?.status === 'NOTIFIED').length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor="#a78bfa" />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📊 Dashboard</Text>
          <Text style={styles.headerSub}>{user?.displayName} · Manager View</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {bar && (
        <View style={styles.heroCard}>
          <Text style={styles.heroBarName}>{bar.name}</Text>
          <View style={styles.heroMetrics}>
            <MetricBox label="Inside" value={`${bar.currentCount}`} sub={`/ ${bar.maxCapacity}`} color={statusColor} />
            <MetricBox label="Queue" value={`${queue.length}`} sub="waiting" color="#a78bfa" />
            <MetricBox label="Velocity" value={`${velocity}`} sub="admits/min" color="#3b82f6" />
          </View>
          <View style={styles.occTrack}>
            <View style={[styles.occFill, { width: `${Math.min(occupancyPct, 100)}%` as any, backgroundColor: statusColor }]} />
          </View>
          <Text style={styles.occLabel}>{occupancyPct}% capacity</Text>
        </View>
      )}

      <View style={styles.statusRow}>
        <StatusPill label="Waiting" count={waitingCount} color="#6b7280" />
        <StatusPill label="Notified" count={notifiedCount} color="#f59e0b" />
        <StatusPill label="Inside" count={bar?.currentCount ?? 0} color="#10b981" />
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(staff)/door')}
        >
          <Text style={styles.actionIcon}>🚪</Text>
          <Text style={styles.actionLabel}>Door Mode</Text>
          <Text style={styles.actionSub}>Scan & admit patrons</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { borderColor: '#10b98144', marginTop: 12 }]}
          onPress={handleSimulateCheckIn}
          disabled={simulating}
        >
          <Text style={styles.actionIcon}>🎲</Text>
          <Text style={[styles.actionLabel, { color: '#10b981' }]}>Simulate Walk-In</Text>
          <Text style={styles.actionSub}>
            {simulating ? 'Adding random patron...' : 'Randomly check in a patron'}
          </Text>
        </TouchableOpacity>
      </View>

      {socialStats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧑‍🤝‍🧑 People Inside</Text>
          <View style={styles.statGrid}>
            <MetricBox label="Total" value={`${socialStats.total}`} sub="inside" color="#fff" />
            <MetricBox label="Profiles" value={`${socialStats.withProfile}`} sub="of people" color="#a78bfa" />
            <MetricBox label="People" value={`${socialStats.people}`} sub="counted" color="#3b82f6" />
          </View>
          <Text style={styles.subHead}>Gender</Text>
          <View style={styles.statGrid}>
            <MetricBox label="Male" value={`${socialStats.genderRatio.male}`} sub={`${socialStats.genderRatio.malePct}%`} color="#3b82f6" />
            <MetricBox label="Female" value={`${socialStats.genderRatio.female}`} sub={`${socialStats.genderRatio.femalePct}%`} color="#ec4899" />
            <MetricBox label="Other" value={`${socialStats.genderRatio.other}`} sub="of people" color="#6b7280" />
          </View>
          <Text style={styles.subHead}>Age</Text>
          <View style={styles.statGrid}>
            {Object.entries(socialStats.ageBuckets).map(([label, count]: [string, any]) => (
              <MetricBox key={label} label={label} value={`${count}`} sub="" color="#a78bfa" />
            ))}
          </View>
          <Text style={styles.subHead}>Group Size</Text>
          <View style={styles.statGrid}>
            <MetricBox label="Solo" value={`${socialStats.groupSizes.solo}`} sub="" color="#10b981" />
            <MetricBox label="Pairs" value={`${socialStats.groupSizes.pairs}`} sub="" color="#10b981" />
            <MetricBox label="Trios" value={`${socialStats.groupSizes.trios}`} sub="" color="#10b981" />
            <MetricBox label="4+" value={`${socialStats.groupSizes.groups}`} sub="" color="#10b981" />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Live Queue ({queue.length})</Text>
        {queue.length === 0 ? (
          <Text style={styles.emptyText}>No one in queue</Text>
        ) : (
          queue.slice(0, 30).map((entry: any, idx: number) => (
            <QueueRow key={entry?.id ?? idx} entry={entry} position={idx + 1} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function MetricBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricSub}>{sub}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color + '66', backgroundColor: color + '11' }]}>
      <Text style={[styles.pillCount, { color }]}>{count}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

function QueueRow({ entry, position }: { entry: any; position: number }) {
  const statusColors: Record<string, string> = {
    WAITING: '#6b7280',
    NOTIFIED: '#f59e0b',
    INSIDE: '#10b981',
    AWAY: '#3b82f6',
    EXITED: '#4b5563',
    EVICTED: '#ef4444',
  };
  const color = statusColors[entry?.status] ?? '#6b7280';

  return (
    <View style={styles.queueRow}>
      <Text style={styles.queuePos}>#{position}</Text>
      <View style={styles.queueInfo}>
        <Text style={styles.queueId}>{entry?.id?.slice(0, 8) ?? '—'}...</Text>
        <Text style={styles.queueSub}>
          Party of {entry?.partySize ?? '?'} · Joined {entry?.joinedAt ? new Date(entry.joinedAt).toLocaleTimeString() : '—'}
        </Text>
      </View>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.queueStatus, { color }]}>{entry?.status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSub: { color: '#6b7280', fontSize: 13, marginTop: 2 },
  logoutBtn: {
    backgroundColor: '#1c1c2e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  logoutText: { color: '#9ca3af', fontSize: 13 },
  heroCard: {
    marginHorizontal: 16,
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  heroBarName: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  heroMetrics: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  metricBox: { alignItems: 'center', flex: 1, minWidth: '30%' },
  metricValue: { fontSize: 36, fontWeight: 'bold' },
  metricSub: { color: '#6b7280', fontSize: 12 },
  metricLabel: { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  occTrack: { height: 6, backgroundColor: '#374151', borderRadius: 3, overflow: 'hidden' },
  occFill: { height: '100%', borderRadius: 3 },
  occLabel: { color: '#6b7280', fontSize: 12, marginTop: 6, textAlign: 'center' },
  statusRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 12 },
  pill: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  pillCount: { fontSize: 24, fontWeight: 'bold' },
  pillLabel: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  actionsRow: { marginHorizontal: 16, marginBottom: 12, gap: 0 },
  actionCard: {
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#7c3aed44',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionIcon: { fontSize: 32 },
  actionLabel: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  actionSub: { color: '#6b7280', fontSize: 13 },
  section: {
    marginHorizontal: 16,
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  subHead: { color: '#6b7280', fontSize: 12, marginTop: 12, marginBottom: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emptyText: { color: '#4b5563', textAlign: 'center', paddingVertical: 20, fontSize: 14 },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
    gap: 8,
  },
  queuePos: { color: '#a78bfa', fontWeight: 'bold', fontSize: 14, width: 28 },
  queueInfo: { flex: 1 },
  queueId: { color: '#fff', fontSize: 13, fontWeight: '600' },
  queueSub: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  queueStatus: { fontSize: 11, fontWeight: '600', minWidth: 52 },
});
