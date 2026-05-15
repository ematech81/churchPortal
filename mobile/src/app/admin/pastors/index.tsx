import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  StatusBar, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../services/api';
import { C } from '../../../constants/theme';

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserPastor {
  id: string; firstName: string; lastName: string;
  email: string; phone: string | null; churchId: string | null; role: string;
  _source: 'user';
}

interface MemberPastor {
  id: string; firstName: string; lastName: string;
  email: string | null; phone: string; churchId: string;
  status: string; departmentName: string | null; pastoralPosition: string | null;
  _source: 'member';
}

type AnyPastor = UserPastor | MemberPastor;

interface Branch {
  id: string; name: string; city: string | null;
  memberCount: number; workerCount: number;
  pastor: Partial<UserPastor> | null;
}

const ROLE_LABELS: Record<string, string> = {
  SENIOR_PASTOR: 'LEAD PASTOR',   senior_pastor: 'LEAD PASTOR',
  BRANCH_PASTOR: 'BRANCH PASTOR', branch_pastor: 'BRANCH PASTOR',
};

const STATUS_LABELS: Record<string, string> = {
  minister: 'MINISTER', pastor: 'PASTOR',
};

function initials(first: string, last: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

// ── Pastor Card ────────────────────────────────────────────────────────────────

function PastorCard({ pastor, branch, onPress }: {
  pastor: AnyPastor; branch: Branch | null; onPress: () => void;
}) {
  const isUser = pastor._source === 'user';
  const roleLabel = isUser
    ? (ROLE_LABELS[(pastor as UserPastor).role] ?? 'BRANCH PASTOR')
    : (STATUS_LABELS[(pastor as MemberPastor).status] ?? 'MINISTER');

  const pastorName = `${pastor.firstName} ${pastor.lastName}`;
  const specialization = isUser
    ? null
    : (pastor as MemberPastor).pastoralPosition?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? (pastor as MemberPastor).departmentName;

  return (
    <TouchableOpacity style={p.card} onPress={onPress} activeOpacity={0.88}>
      {/* Top section */}
      <View style={p.cardTop}>
        <View style={p.avatarRing}>
          <View style={p.avatar}>
            <Text style={p.avatarText}>{initials(pastor.firstName, pastor.lastName)}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <View style={p.roleBadge}>
            <Text style={p.roleBadgeText}>{roleLabel}</Text>
          </View>
          <Text style={p.name}>{pastorName}</Text>
          {specialization ? (
            <Text style={p.specialization}>{specialization}</Text>
          ) : null}
          {branch ? (
            <View style={p.locationRow}>
              <Ionicons name="location-outline" size={12} color={C.textGray} />
              <Text style={p.locationText} numberOfLines={1}>
                {branch.name}{branch.city ? `, ${branch.city}` : ''}
              </Text>
            </View>
          ) : (
            <View style={p.locationRow}>
              <Ionicons name="alert-circle-outline" size={12} color="#F59E0B" />
              <Text style={[p.locationText, { color: '#92400E' }]}>No branch assigned</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats bottom bar */}
      <View style={p.cardStats}>
        <View style={p.statItem}>
          <Ionicons name="people" size={15} color={C.accent} />
          <View>
            <Text style={p.statNum}>{(branch?.memberCount ?? 0).toLocaleString()}</Text>
            <Text style={p.statLbl}>Congregation</Text>
          </View>
        </View>
        <View style={p.statDivider} />
        <View style={p.statItem}>
          <Ionicons name="ribbon" size={15} color={C.accent} />
          <View>
            <Text style={p.statNum}>{(branch?.workerCount ?? 0).toLocaleString()}</Text>
            <Text style={p.statLbl}>Active Workers</Text>
          </View>
        </View>
        {!isUser && (
          <>
            <View style={p.statDivider} />
            <View style={p.memberSourceBadge}>
              <Text style={p.memberSourceText}>DIRECTORY</Text>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function PastorsScreen() {
  const router = useRouter();
  const [userPastors, setUserPastors] = useState<UserPastor[]>([]);
  const [memberPastors, setMemberPastors] = useState<MemberPastor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [uRes, bRes, mMinRes, mPastRes] = await Promise.all([
        api.get('/churches/pastors'),
        api.get('/churches/branches'),
        api.get('/members', { params: { status: 'minister', limit: 200 } }),
        api.get('/members', { params: { status: 'pastor', limit: 200 } }),
      ]);
      setUserPastors((uRes.data ?? []).map((u: any) => ({ ...u, _source: 'user' })));
      setBranches(bRes.data ?? []);

      // Combine minister + pastor members, tag source
      const ministers = (mMinRes.data ?? []).map((m: any) => ({ ...m, _source: 'member' }));
      const pastors   = (mPastRes.data ?? []).map((m: any) => ({ ...m, _source: 'member' }));
      // Deduplicate by id
      const seen = new Set<string>();
      const combined: MemberPastor[] = [];
      for (const m of [...ministers, ...pastors]) {
        if (!seen.has(m.id)) { seen.add(m.id); combined.push(m); }
      }
      setMemberPastors(combined);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  // Combine both sources into a single list
  const allPastors: AnyPastor[] = useMemo(() => {
    // User pastors come first (they have admin login access)
    const all: AnyPastor[] = [...userPastors, ...memberPastors];

    // Filter out member-pastors already shown as user-pastors (same person, different record)
    // Use email as dedup key
    const userEmails = new Set(userPastors.map((u) => u.email.toLowerCase()));
    return all.filter((p) =>
      p._source === 'user' ||
      !p.email ||
      !userEmails.has((p.email as string).toLowerCase()),
    );
  }, [userPastors, memberPastors]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allPastors;
    const q = search.toLowerCase();
    return allPastors.filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      (branchMap.get(p.churchId ?? '')?.name ?? '').toLowerCase().includes(q),
    );
  }, [allPastors, search, branchMap]);

  const navigateToPastor = (pastor: AnyPastor) => {
    const branch = branchMap.get(pastor.churchId ?? '');
    router.push({
      pathname: '/admin/pastors/[id]',
      params: {
        id: pastor.id,
        pastorName: `${pastor.firstName} ${pastor.lastName}`,
        pastorEmail: pastor.email ?? '',
        pastorPhone: ('phone' in pastor ? pastor.phone : null) ?? '',
        pastorRole: pastor._source === 'user'
          ? (pastor as UserPastor).role
          : (pastor as MemberPastor).status,
        churchId: pastor.churchId ?? '',
        branchName: branch?.name ?? '',
        branchCity: branch?.city ?? '',
        memberCount: String(branch?.memberCount ?? 0),
        workerCount: String(branch?.workerCount ?? 0),
        source: pastor._source,
      },
    } as any);
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
            <Text style={s.headerTitle}>Clergy Directory</Text>
            <Text style={s.headerSub}>
              {allPastors.length} pastor{allPastors.length !== 1 ? 's' : ''} across the ministry
            </Text>
          </View>
        </View>

        {/* Assign CTA */}
        <View style={s.ctaWrap}>
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={() => router.push('/admin/pastors/assign' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="person-add" size={18} color={C.dark} />
            <Text style={s.ctaBtnText}>ASSIGN NEW PASTOR</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <View style={s.searchBar}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, rank, or branch..."
              placeholderTextColor="rgba(255,255,255,0.35)"
            />
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={[s.centered, { backgroundColor: C.bg }]}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => `${p._source}-${p.id}`}
          style={{ flex: 1, backgroundColor: C.bg }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={C.accent} />}
          renderItem={({ item }) => (
            <PastorCard
              pastor={item}
              branch={branchMap.get(item.churchId ?? '') ?? null}
              onPress={() => navigateToPastor(item)}
            />
          )}
          ListFooterComponent={
            <TouchableOpacity
              style={s.addCard}
              onPress={() => router.push('/admin/pastors/assign' as any)}
              activeOpacity={0.75}
            >
              <View style={s.addCardIcon}>
                <Ionicons name="add" size={26} color={C.border} />
              </View>
              <Text style={s.addCardTitle}>Add Ordained Minister</Text>
              <Text style={s.addCardSub}>Expand your leadership network</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="person-circle-outline" size={52} color={C.border} />
              <Text style={s.emptyTitle}>No pastors found</Text>
              <Text style={s.emptySub}>
                Register members with "Pastor" or "Minister" status, or invite branch pastors via phone OTP.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn: { padding: 4, marginTop: 2 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.white },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  ctaWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14 },
  ctaBtnText: { fontSize: 14, fontWeight: '800', color: C.dark, letterSpacing: 0.5 },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 0 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  searchInput: { flex: 1, fontSize: 14, color: C.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  addCard: { borderRadius: 18, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', padding: 28, alignItems: 'center', gap: 6, marginTop: 4 },
  addCardIcon: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  addCardTitle: { fontSize: 15, fontWeight: '700', color: C.textGray },
  addCardSub: { fontSize: 12, color: C.border },
  empty: { alignItems: 'center', gap: 8, paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.textDark },
  emptySub: { fontSize: 13, color: C.textGray, textAlign: 'center', paddingHorizontal: 20 },
});

const p = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 18, marginBottom: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 14 },
  avatarRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: C.accent, padding: 2, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: '100%', height: '100%', borderRadius: 28, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: C.accent },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: C.dark, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  roleBadgeText: { fontSize: 9, fontWeight: '800', color: C.accent, letterSpacing: 0.8 },
  name: { fontSize: 17, fontWeight: '800', color: C.textDark, marginBottom: 4 },
  specialization: { fontSize: 12, color: C.accent, fontWeight: '600', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 12, color: C.textGray, fontWeight: '600', flex: 1 },
  cardStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.dark, paddingHorizontal: 16, paddingVertical: 14 },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 12 },
  statNum: { fontSize: 18, fontWeight: '800', color: C.accent },
  statLbl: { fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 1 },
  memberSourceBadge: { backgroundColor: 'rgba(245,197,24,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  memberSourceText: { fontSize: 9, fontWeight: '800', color: C.accent, letterSpacing: 0.5 },
});
