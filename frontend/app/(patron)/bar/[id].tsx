import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, FlatList, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { barsApi, dealsApi, socialApi } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { getSocket, subscribeToBar } from '../../../lib/socket';

type TabKey = 'info' | 'happyhour' | 'lounge';

export default function BarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [bar, setBar] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [loungeUsers, setLoungeUsers] = useState<any[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [socialStats, setSocialStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    fetchMyProfile();
    setupSocket();
  }, [id]);

  async function fetchAll() {
    try {
      const [barRes, dealsRes, statsRes] = await Promise.all([
        barsApi.get(id!),
        dealsApi.active(id!).catch(() => ({ data: [] })),
        barsApi.socialStats(id!).catch(() => ({ data: null })),
      ]);
      setBar(barRes.data);
      setDeals(dealsRes.data);
      setSocialStats(statsRes.data);
    } catch {
      Alert.alert('Error', 'Could not load bar details.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchLounge() {
    try {
      const res = await socialApi.getLoungeUsers(id!);
      setLoungeUsers(res.data);
    } catch {}
  }

  async function fetchMyProfile() {
    if (!user) return;
    try {
      const res = await socialApi.getProfile(user.id);
      setMyProfile(res.data);
    } catch {
      setMyProfile(null);
    }
  }

  async function setupSocket() {
    await getSocket();
    subscribeToBar(id!, (data: any) => {
      setBar((prev: any) => (prev ? { ...prev, ...data } : prev));
    });
  }

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    if (tab === 'lounge') {
      fetchMyProfile();
      fetchLounge();
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  if (!bar) return null;

  const occupancyPct = Math.round((bar.currentCount / bar.maxCapacity) * 100);
  const isFull = bar.currentCount >= bar.maxCapacity;
  const statusColor = occupancyPct >= 90 ? '#ef4444' : occupancyPct >= 70 ? '#f59e0b' : '#10b981';

  const activeDeals = deals.filter((d) => {
    const now = Date.now();
    return new Date(d.startsAt).getTime() <= now && new Date(d.endsAt).getTime() >= now;
  });

  return (
    <View style={styles.container}>
      {/* Hero bar */}
      <View style={styles.heroCard}>
        <Text style={styles.barName}>{bar.name}</Text>
        <Text style={styles.barAddress}>📍 {bar.address}</Text>
        <View style={styles.hoursRow}>
          <Text style={styles.hoursText}>🕐 {bar.openTime} – {bar.closeTime}</Text>
          {bar.coverCharge != null && (
            <Text style={styles.hoursText}>💵 ${bar.coverCharge} cover</Text>
          )}
        </View>
      </View>

      {/* Live stats strip */}
      <View style={styles.statsStrip}>
        <StatChip label="Inside" value={`${bar.currentCount}/${bar.maxCapacity}`} color={statusColor} />
        <StatChip label="Queue" value={`${bar.queueLength ?? 0}`} color="#a78bfa" />
        <StatChip label="Wait" value={`${bar.estimatedWaitMins ?? 0}m`} color="#3b82f6" />
        {activeDeals.length > 0 && (
          <StatChip label="🍹 Deals" value={`${activeDeals.length}`} color="#f59e0b" />
        )}
      </View>

      {/* Occupancy bar */}
      <View style={styles.occTrackWrap}>
        <View style={styles.occTrack}>
          <View style={[styles.occFill, { width: `${Math.min(occupancyPct, 100)}%` as any, backgroundColor: statusColor }]} />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['info', 'happyhour', 'lounge'] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'info' ? 'Info' : tab === 'happyhour' ? '🍹 Happy Hour' : '👥 Lounge'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <ScrollView contentContainerStyle={styles.tabContent}>
        {activeTab === 'info' && (
          <>
            {bar.description && (
              <View style={styles.section}>
                <Text style={styles.barDesc}>{bar.description}</Text>
              </View>
            )}
            {socialStats && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📊 People Inside</Text>
                <Text style={styles.subHead}>Group size breakdown</Text>
                <View style={styles.demoGrid}>
                  <DemoStat label="Solo" value={socialStats.groupSizes.solo} />
                  <DemoStat label="Pairs" value={socialStats.groupSizes.pairs} />
                  <DemoStat label="Trios" value={socialStats.groupSizes.trios} />
                  <DemoStat label="Groups 4+" value={socialStats.groupSizes.groups} />
                </View>
                <Text style={styles.subHead}>Gender ratio</Text>
                <View style={styles.genderRow}>
                  <View style={[styles.genderBox, { borderColor: '#3b82f6' }]}>
                    <Text style={styles.genderEmoji}>♂</Text>
                    <Text style={styles.genderBig}>{socialStats.genderRatio.male}</Text>
                    <Text style={styles.genderPct}>{socialStats.genderRatio.malePct}%</Text>
                  </View>
                  <View style={[styles.genderBox, { borderColor: '#ec4899' }]}>
                    <Text style={styles.genderEmoji}>♀</Text>
                    <Text style={styles.genderBig}>{socialStats.genderRatio.female}</Text>
                    <Text style={styles.genderPct}>{socialStats.genderRatio.femalePct}%</Text>
                  </View>
                  <View style={[styles.genderBox, { borderColor: '#6b7280' }]}>
                    <Text style={styles.genderEmoji}>⚧</Text>
                    <Text style={styles.genderBig}>{socialStats.genderRatio.other}</Text>
                    <Text style={styles.genderPct}>other</Text>
                  </View>
                </View>
                <Text style={styles.subHead}>Age distribution</Text>
                <View style={styles.ageGrid}>
                  {Object.entries(socialStats.ageBuckets).map(([label, count]: [string, any]) => (
                    <View key={label} style={styles.ageBox}>
                      <Text style={styles.ageCount}>{count}</Text>
                      <Text style={styles.ageLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.statsFoot}>
                  {socialStats.withProfile} of {socialStats.people} inside have profiles
                </Text>
              </View>
            )}
            {bar.promos?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎉 Tonight's Promos</Text>
                {bar.promos.map((p: string, i: number) => (
                  <Text key={i} style={styles.promoText}>• {p}</Text>
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'happyhour' && (
          <>
            {deals.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🍹</Text>
                <Text style={styles.emptyTitle}>No deals scheduled</Text>
                <Text style={styles.emptySub}>Check back later for happy hour specials</Text>
              </View>
            ) : (
              deals.map((deal) => {
                const now = Date.now();
                const isLive = new Date(deal.startsAt).getTime() <= now && new Date(deal.endsAt).getTime() >= now;
                const startStr = new Date(deal.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const endStr = new Date(deal.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <View key={deal.id} style={[styles.dealCard, isLive && styles.dealCardLive]}>
                    {isLive && (
                      <View style={styles.livePill}>
                        <Text style={styles.livePillText}>🔴 LIVE NOW</Text>
                      </View>
                    )}
                    <Text style={styles.dealTitle}>{deal.title}</Text>
                    <Text style={styles.dealDesc}>{deal.description}</Text>
                    <Text style={styles.dealTime}>⏰ {startStr} – {endStr}</Text>
                  </View>
                );
              })
            )}
          </>
        )}

        {activeTab === 'lounge' && (
          <>
            <Text style={styles.loungeHint}>
              People currently inside who are open to chatting
            </Text>

            {!user && (
              <View style={styles.consentCard}>
                <Text style={styles.consentTitle}>Sign in to join the Lounge</Text>
                <Text style={styles.consentSub}>Create an account to chat with people inside.</Text>
                <TouchableOpacity style={styles.consentBtn} onPress={() => router.push('/(auth)/login')}>
                  <Text style={styles.consentBtnText}>Sign In</Text>
                </TouchableOpacity>
              </View>
            )}

            {user && !myProfile?.openToChat && (
              <View style={styles.consentCard}>
                <Text style={styles.consentTitle}>Enable Chat</Text>
                <Text style={styles.consentSub}>
                  Turn on chat and choose what you want to share (gender, age, bio, photo).
                </Text>
                <TouchableOpacity style={styles.consentBtn} onPress={() => router.push('/(patron)/profile')}>
                  <Text style={styles.consentBtnText}>Set Up Chat Profile</Text>
                </TouchableOpacity>
              </View>
            )}

            {loungeUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>Nobody here yet</Text>
                <Text style={styles.emptySub}>Be the first inside and turn on open-to-chat in your profile</Text>
              </View>
            ) : (
              <View style={styles.loungeGrid}>
                {loungeUsers.map((u: any) => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.loungeCard}
                    onPress={() =>
                      user
                        ? router.push({
                            pathname: '/(patron)/chat/[userId]',
                            params: { userId: u.id, barId: id, displayName: u.displayName },
                          })
                        : router.push('/(auth)/login')
                    }
                  >
                    <View style={styles.loungeAvatar}>
                      {u.profile?.photoUrl ? (
                        <Image source={{ uri: u.profile.photoUrl }} style={styles.loungeAvatarImg} />
                      ) : (
                        <Text style={styles.loungeAvatarEmoji}>
                          {u.displayName?.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.loungeName} numberOfLines={1}>{u.displayName}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                      {u.profile?.gender && (
                        <Text style={styles.loungeGender}>{u.profile.gender}</Text>
                      )}
                      {u.profile?.age && (
                        <Text style={styles.loungeAge}>{u.profile.age}</Text>
                      )}
                    </View>
                    {u.profile?.bio && (
                      <Text style={styles.loungeBio} numberOfLines={2}>{u.profile.bio}</Text>
                    )}
                    <View style={styles.chatBadge}>
                      <Text style={styles.chatBadgeText}>💬 Chat</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Sticky join button */}
      <View style={styles.stickyAction}>
        {user ? (
          <TouchableOpacity
            style={[styles.joinBtn, isFull && styles.joinBtnDisabled]}
            onPress={() => router.push(`/(patron)/queue/${id}`)}
            disabled={isFull}
          >
            <Text style={styles.joinBtnText}>
              {isFull ? '🚫 Bar is Full' : '➕ Join Queue'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.joinBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.joinBtnText}>Sign In to Join Queue</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.chip, { borderColor: color + '55' }]}>
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function DemoStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.demoBox}>
      <Text style={styles.demoBig}>{value}</Text>
      <Text style={styles.demoLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },

  heroCard: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#1c1c2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  barName: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  barAddress: { color: '#9ca3af', fontSize: 13, marginBottom: 4 },
  hoursRow: { flexDirection: 'row', gap: 14 },
  hoursText: { color: '#a78bfa', fontSize: 13 },

  statsStrip: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#1c1c2e',
  },
  chip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
  },
  chipValue: { fontSize: 16, fontWeight: 'bold' },
  chipLabel: { color: '#6b7280', fontSize: 10, marginTop: 1 },

  occTrackWrap: { paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#1c1c2e' },
  occTrack: { height: 5, backgroundColor: '#374151', borderRadius: 3, overflow: 'hidden' },
  occFill: { height: '100%', borderRadius: 3 },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
    backgroundColor: '#1c1c2e',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#7c3aed' },
  tabText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#a78bfa' },

  tabContent: { padding: 16, paddingBottom: 100 },
  section: {
    backgroundColor: '#1c1c2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  barDesc: { color: '#d1d5db', fontSize: 14, lineHeight: 22 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 12 },
  demoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  demoBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0f0f1a',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  demoBig: { fontSize: 24, fontWeight: 'bold', color: '#a78bfa' },
  demoLabel: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  promoText: { color: '#d1d5db', fontSize: 14, marginBottom: 6 },

  dealCard: {
    backgroundColor: '#1c1c2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  dealCardLive: { borderColor: '#f59e0b88', backgroundColor: '#f59e0b11' },
  livePill: {
    backgroundColor: '#ef444422',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  livePillText: { color: '#ef4444', fontSize: 11, fontWeight: '700' },
  dealTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  dealDesc: { color: '#d1d5db', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  dealTime: { color: '#f59e0b', fontSize: 13 },

  loungeHint: { color: '#6b7280', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  loungeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  loungeCard: {
    width: '47%',
    backgroundColor: '#1c1c2e',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  loungeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#7c3aed33',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#7c3aed',
  },
  loungeAvatarImg: { width: 60, height: 60, borderRadius: 30 },
  loungeAvatarEmoji: { fontSize: 26, color: '#a78bfa', fontWeight: 'bold' },
  loungeName: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  loungeGender: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },
  loungeAge: { color: '#6b7280', fontSize: 12, marginBottom: 4 },
  loungeBio: { color: '#9ca3af', fontSize: 11, textAlign: 'center', marginBottom: 8 },
  chatBadge: {
    backgroundColor: '#7c3aed22',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  chatBadgeText: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },

  consentCard: {
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#7c3aed44',
    alignItems: 'center',
  },
  consentTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 6 },
  consentSub: { color: '#6b7280', fontSize: 13, textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  consentBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  consentBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 6 },
  emptySub: { color: '#6b7280', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  stickyAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#0f0f1acc',
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  joinBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinBtnDisabled: { backgroundColor: '#374151' },
  joinBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  subHead: { color: '#6b7280', fontSize: 12, marginTop: 12, marginBottom: 8 },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  genderBox: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  genderEmoji: { fontSize: 22, marginBottom: 4 },
  genderBig: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  genderPct: { color: '#6b7280', fontSize: 12, marginTop: 2 },

  ageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ageBox: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: '#0f0f1a',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  ageCount: { color: '#a78bfa', fontSize: 18, fontWeight: 'bold' },
  ageLabel: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  statsFoot: { color: '#6b7280', fontSize: 12, marginTop: 12, textAlign: 'center' },
});
