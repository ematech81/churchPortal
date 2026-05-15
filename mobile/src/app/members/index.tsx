import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, StatusBar, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { C } from '../../constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  memberId: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  status: string;
  churchRole: string | null;
  photoUrl: string | null;
  membershipCategory: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'member',    label: 'Member' },
  { key: 'worker',    label: 'Worker' },
  { key: 'pastor',    label: 'Pastor' },
  { key: 'minister',  label: 'Minister' },
  { key: 'visitor',   label: 'Visitor' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  member:      { bg: '#DCFCE7', text: '#166534' },
  worker:      { bg: '#EDE9FE', text: '#5B21B6' },
  visitor:     { bg: '#FEF9C3', text: '#854D0E' },
  first_timer: { bg: '#DBEAFE', text: '#1E40AF' },
  minister:    { bg: '#FEF2F2', text: '#991B1B' },
  pastor:      { bg: '#120D2E', text: '#F5C518' },
  new_convert: { bg: '#CCFBF1', text: '#0F766E' },
};

function statusColor(status: string) {
  return STATUS_COLORS[status.toLowerCase()] ?? { bg: C.bg, text: C.textGray };
}

function initials(member: Member) {
  return `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase();
}

// ── Member Card ───────────────────────────────────────────────────────────────

function MemberCard({ member, onPress }: { member: Member; onPress: () => void }) {
  const col = statusColor(member.status);
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>{initials(member)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.cardName}>{member.firstName} {member.lastName}</Text>
        {member.memberId && (
          <Text style={s.cardId}>{member.memberId}</Text>
        )}
        <View style={[s.statusBadge, { backgroundColor: col.bg }]}>
          <Text style={[s.statusText, { color: col.text }]}>
            {member.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={s.msgBtn} activeOpacity={0.8}>
        <Ionicons name="chatbubble-ellipses" size={18} color={C.white} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MembersScreen() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchMembers = useCallback(async (q = search, filter = activeFilter) => {
    try {
      const params: Record<string, string> = {};
      if (q) params.search = q;
      if (filter !== 'all') params.status = filter;
      const res = await api.get('/members', { params });
      setMembers(res.data);
    } catch {
      // keep existing list on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, activeFilter]);

  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get('/members/count');
      setTotal(typeof res.data === 'number' ? res.data : res.data?.count ?? 0);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
      fetchCount();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const onSearch = (text: string) => {
    setSearch(text);
    fetchMembers(text, activeFilter);
  };

  const onFilter = (key: string) => {
    setActiveFilter(key);
    fetchMembers(search, key);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMembers();
    fetchCount();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.dark }}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark} />
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.dark }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>People & Membership</Text>
            <Text style={s.headerSub}>{total} total members</Text>
          </View>
          <TouchableOpacity style={s.headerIconBtn}>
            <Ionicons name="options-outline" size={22} color={C.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={18} color={C.textGray} />
          <TextInput
            style={s.searchInput}
            placeholder="Search members or phone..."
            placeholderTextColor={C.textGray}
            value={search}
            onChangeText={onSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => onSearch('')}>
              <Ionicons name="close-circle" size={18} color={C.textGray} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
          style={{ flexGrow: 0 }}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[s.chip, activeFilter === f.key && s.chipActive]}
              onPress={() => onFilter(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[s.chipText, activeFilter === f.key && s.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* List */}
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        ) : members.length === 0 ? (
          <View style={s.centered}>
            <Ionicons name="people-outline" size={52} color={C.border} />
            <Text style={s.emptyTitle}>No members found</Text>
            <Text style={s.emptySub}>
              {search ? 'Try a different search term' : 'Tap + to register your first member'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
            renderItem={({ item }) => (
              <MemberCard
                member={item}
                onPress={() => router.push({ pathname: '/members/[id]', params: { id: item.id } } as any)}
              />
            )}
          />
        )}

        {/* FAB */}
        <TouchableOpacity
          style={s.fab}
          onPress={() => router.push('/members/add' as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={30} color={C.dark} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  headerIconBtn: { padding: 4 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, marginHorizontal: 16, marginTop: 16, marginBottom: 12, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, color: C.textDark },
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8, marginBottom: 4, paddingRight: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, alignSelf: 'flex-start' },
  chipActive: { backgroundColor: C.dark, borderColor: C.dark },
  chipText: { fontSize: 13, fontWeight: '600', color: C.textGray },
  chipTextActive: { color: C.white },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, gap: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: C.accent },
  cardName: { fontSize: 15, fontWeight: '700', color: C.textDark, marginBottom: 2 },
  cardId: { fontSize: 11, color: C.textGray, marginBottom: 4 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  msgBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.textDark },
  emptySub: { fontSize: 13, color: C.textGray, textAlign: 'center', paddingHorizontal: 32 },
  fab: { position: 'absolute', bottom: 28, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
});
