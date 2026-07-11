import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { barsApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

interface Bar {
  id: string;
  name: string;
  address: string;
  maxCapacity: number;
  currentCount: number;
  occupancyPct: number;
  queueLength: number;
  estimatedWaitMins: number;
  coverCharge: number | null;
  promos: string[];
  isActive: boolean;
}

function OccupancyBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981';
  return (
    <View style={styles.occTrack}>
      <View style={[styles.occFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function BarCard({ bar, onPress }: { bar: Bar; onPress: () => void }) {
  const statusColor = bar.occupancyPct >= 90 ? '#ef4444' : bar.occupancyPct >= 70 ? '#f59e0b' : '#10b981';
  const statusLabel = bar.occupancyPct >= 90 ? 'Packed' : bar.occupancyPct >= 70 ? 'Busy' : 'Open';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{bar.name}</Text>
          <Text style={styles.cardAddress}>{bar.address}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <OccupancyBar pct={bar.occupancyPct} />

      <View style={styles.cardStats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{bar.currentCount}/{bar.maxCapacity}</Text>
          <Text style={styles.statLabel}>Inside</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{bar.queueLength}</Text>
          <Text style={styles.statLabel}>In Queue</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{bar.estimatedWaitMins}m</Text>
          <Text style={styles.statLabel}>Est. Wait</Text>
        </View>
        {bar.coverCharge != null && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>${bar.coverCharge}</Text>
            <Text style={styles.statLabel}>Cover</Text>
          </View>
        )}
      </View>

      {bar.promos.length > 0 && (
        <View style={styles.promoRow}>
          {bar.promos.slice(0, 2).map((p, i) => (
            <View key={i} style={styles.promoBadge}>
              <Text style={styles.promoText}>🎉 {p}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [bars, setBars] = useState<Bar[]>([]);
  const [filtered, setFiltered] = useState<Bar[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBars = useCallback(async () => {
    try {
      const res = await barsApi.list();
      setBars(res.data);
      setFiltered(res.data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBars(); }, [fetchBars]);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(bars);
    } else {
      setFiltered(bars.filter(b =>
        b.name.toLowerCase().includes(query.toLowerCase()) ||
        b.address.toLowerCase().includes(query.toLowerCase())
      ));
    }
  }, [query, bars]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#a78bfa" />
        <Text style={styles.loadingText}>Finding bars near you...</Text>
      </View>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🍺 BarLink</Text>
          <Text style={styles.headerSub}>Live bar capacity & queue</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search bars..."
        placeholderTextColor="#4b5563"
      />

      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <BarCard
            bar={item}
            onPress={() => router.push(`/(patron)/bar/${item.id}`)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchBars(); }}
            tintColor="#a78bfa"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No bars found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a', gap: 12 },
  loadingText: { color: '#6b7280', fontSize: 14 },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 30, fontWeight: 'bold', color: '#fff' },
  headerSub: { color: '#6b7280', fontSize: 14, marginTop: 2 },
  logoutBtn: {
    backgroundColor: '#1c1c2e',
    borderWidth: 1,
    borderColor: '#7c3aed',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logoutText: { color: '#a78bfa', fontSize: 13, fontWeight: '600' },
  search: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#1c1c2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#374151',
  },
  card: {
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  cardName: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  cardAddress: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  occTrack: {
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  occFill: { height: '100%', borderRadius: 3 },
  cardStats: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  stat: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statLabel: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  promoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  promoBadge: {
    backgroundColor: '#7c3aed22',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#7c3aed44',
  },
  promoText: { color: '#a78bfa', fontSize: 11 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 16 },
});
