import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  StatusBar, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../services/api';
import { C } from '../../../constants/theme';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Branch {
  id: string; name: string; city: string | null; address: string | null;
  memberCount: number; pastor: any | null;
}

interface EligiblePastor {
  id: string; firstName: string; lastName: string;
  email: string | null; phone: string | null; churchId: string | null;
  status?: string; role?: string; departmentName?: string | null;
  pastoralPosition?: string | null; _source: 'user' | 'member';
}

function initials(first: string, last: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

function fmtToday() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
}

function getStatusLabel(p: EligiblePastor, branchMap: Map<string, Branch>) {
  if (!p.churchId || !branchMap.has(p.churchId)) return 'Unassigned';
  return 'Eligible for Transfer';
}

function getSpecialization(p: EligiblePastor) {
  if (p.pastoralPosition) return p.pastoralPosition.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  if (p.departmentName) return p.departmentName;
  if (p.role === 'branch_pastor' || p.role === 'senior_pastor') return 'Church Administration';
  return 'General Ministry';
}

function getCurrentLocation(p: EligiblePastor, branchMap: Map<string, Branch>) {
  if (!p.churchId) return 'No location';
  const branch = branchMap.get(p.churchId);
  if (branch) return `${branch.name}${branch.city ? ', ' + branch.city : ''}`;
  return 'Unknown';
}

// ── Pastor Selection Card (matches image 2 design) ────────────────────────────

function EligiblePastorCard({
  pastor, isSelected, branchMap, onSelect,
}: {
  pastor: EligiblePastor; isSelected: boolean;
  branchMap: Map<string, Branch>; onSelect: () => void;
}) {
  const statusLabel = getStatusLabel(pastor, branchMap);
  const isTransfer = statusLabel === 'Eligible for Transfer';

  return (
    <TouchableOpacity
      style={[c.card, isSelected && c.cardSelected]}
      onPress={onSelect}
      activeOpacity={0.85}
    >
      {/* Checkmark badge when selected */}
      {isSelected && (
        <View style={c.checkmark}>
          <Ionicons name="checkmark-circle" size={22} color={C.accent} />
        </View>
      )}

      {/* Header row: avatar + name + experience */}
      <View style={c.cardHead}>
        <View style={[c.avatarRing, isSelected && c.avatarRingSelected]}>
          <View style={c.avatar}>
            <Text style={c.avatarText}>{initials(pastor.firstName, pastor.lastName)}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={c.name}>{pastor.firstName} {pastor.lastName}</Text>
          <View style={c.expBadge}>
            <Text style={c.expText}>
              {pastor._source === 'user' ? 'ADMIN PASTOR' : (pastor.status?.toUpperCase() ?? 'MINISTER')}
            </Text>
          </View>
        </View>
      </View>

      {/* Info rows */}
      <View style={c.infoRows}>
        <View style={c.infoRow}>
          <Text style={c.infoLabel}>Current Status:</Text>
          <Text style={[c.infoValue, isTransfer && { color: '#F59E0B' }]}>{statusLabel}</Text>
        </View>
        <View style={c.infoRow}>
          <Text style={c.infoLabel}>Specialization:</Text>
          <Text style={c.infoValue}>{getSpecialization(pastor)}</Text>
        </View>
        <View style={c.infoRow}>
          <Text style={c.infoLabel}>Current Location:</Text>
          <Text style={c.infoValue}>{getCurrentLocation(pastor, branchMap)}</Text>
        </View>
      </View>

      {/* View Profile button */}
      <TouchableOpacity
        style={[c.viewProfileBtn, isSelected && c.viewProfileBtnSelected]}
        activeOpacity={0.8}
        onPress={onSelect}
      >
        <Text style={[c.viewProfileText, isSelected && { color: C.dark }]}>
          {isSelected ? 'SELECTED ✓' : 'VIEW PROFILE'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function AssignPastorScreen() {
  const router = useRouter();
  const {
    pastorId, pastorName, branchId, branchName, branchCity, mode,
  } = useLocalSearchParams<{
    pastorId?: string; pastorName?: string;
    branchId?: string; branchName?: string; branchCity?: string; mode?: string;
  }>();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [allPastors, setAllPastors] = useState<EligiblePastor[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Selection state
  const [selectedPastor, setSelectedPastor] = useState<EligiblePastor | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [bRes, uRes, mMinRes, mPastRes] = await Promise.all([
          api.get('/churches/branches'),
          api.get('/churches/pastors'),
          api.get('/members', { params: { status: 'minister', limit: 200 } }),
          api.get('/members', { params: { status: 'pastor', limit: 200 } }),
        ]);

        const branchList: Branch[] = bRes.data ?? [];
        setBranches(branchList);

        // Build combined pastor list
        const users: EligiblePastor[] = (uRes.data ?? []).map((u: any) => ({ ...u, _source: 'user' as const }));
        const ministers: EligiblePastor[] = (mMinRes.data ?? []).map((m: any) => ({ ...m, _source: 'member' as const }));
        const pastors: EligiblePastor[] = (mPastRes.data ?? []).map((m: any) => ({ ...m, _source: 'member' as const }));

        // Deduplicate by email
        const seen = new Set<string>();
        const combined: EligiblePastor[] = [];
        for (const p of [...users, ...ministers, ...pastors]) {
          const key = p.email?.toLowerCase() ?? p.id;
          if (!seen.has(key)) { seen.add(key); combined.push(p); }
        }
        setAllPastors(combined);

        // Pre-select from params
        if (pastorId) {
          const found = combined.find((p) => p.id === pastorId);
          if (found) setSelectedPastor(found);
        }
        if (branchId) {
          const found = branchList.find((b) => b.id === branchId);
          if (found) setSelectedBranch(found);
        }
      } catch { }
      finally { setLoading(false); }
    })();
  }, []);

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  const filteredPastors = useMemo(() => {
    if (!search.trim()) return allPastors;
    const q = search.toLowerCase();
    return allPastors.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q));
  }, [allPastors, search]);

  // The branch shown at the top — from params (if opened from branch screen) or selected
  const targetBranch = useMemo(
    () => selectedBranch ?? (branchId ? branches.find((b) => b.id === branchId) ?? null : null),
    [selectedBranch, branchId, branches],
  );

  const handleConfirm = useCallback(async () => {
    if (!selectedPastor || !targetBranch) return;
    setSubmitting(true);
    try {
      if (selectedPastor._source === 'user') {
        // User-based pastor: update their churchId
        await api.patch(`/churches/pastors/${selectedPastor.id}/assign`, { branchId: targetBranch.id });
      } else {
        // Member-based pastor: link via branch lead pastor field
        await api.patch(`/churches/branch/${targetBranch.id}`, {
          leadPastorName: `${selectedPastor.firstName} ${selectedPastor.lastName}`,
        });
      }
      Alert.alert(
        'Assignment Complete',
        `${selectedPastor.firstName} ${selectedPastor.lastName} has been assigned to ${targetBranch.name}.`,
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert('Notice', e?.response?.data?.message ?? 'Could not complete assignment.');
    } finally { setSubmitting(false); }
  }, [selectedPastor, targetBranch]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  const showSummary = !!selectedPastor && !!targetBranch;

  return (
    <View style={{ flex: 1, backgroundColor: C.dark }}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark} />
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.dark }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {mode === 'transfer' ? 'Branch Transfer' : 'Pastor Assignment'}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── TARGET BRANCH card (top, matches image 2) ── */}
        {targetBranch ? (
          <View style={s.branchHeroCard}>
            <View style={s.branchHeroLeft}>
              <Text style={s.branchHeroLabel}>TARGET BRANCH</Text>
              <Text style={s.branchHeroName}>{targetBranch.name}</Text>
              <View style={s.branchHeroMeta}>
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
                <Text style={s.branchHeroCity}>{targetBranch.city ?? 'No location set'}</Text>
              </View>
              <View style={s.branchHeroMeta}>
                <Ionicons name="people-outline" size={12} color="rgba(255,255,255,0.6)" />
                <Text style={s.branchHeroCity}>
                  Congregation: {(targetBranch.memberCount ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={s.vacancyBadge}>
              <Text style={s.vacancyLine1}>VACANCY</Text>
              <Text style={s.vacancyLine2}>PASTOR</Text>
            </View>
          </View>
        ) : (
          // No branch pre-selected → show branch picker
          <View style={{ padding: 16 }}>
            <View style={s.sectionHeader}>
              <View style={s.sectionAccent} />
              <Text style={s.sectionTitle}>Select Target Branch</Text>
            </View>
            {branches.map((branch) => {
              const isSel = selectedBranch?.id === branch.id;
              return (
                <TouchableOpacity
                  key={branch.id}
                  style={[s.branchPickCard, isSel && s.branchPickCardSelected]}
                  onPress={() => setSelectedBranch(branch)}
                  activeOpacity={0.82}
                >
                  {isSel && <View style={s.branchPickCheck}><Ionicons name="checkmark-circle" size={20} color={C.accent} /></View>}
                  <Text style={[s.branchPickName, isSel && { color: C.dark }]}>{branch.name}</Text>
                  {branch.city ? <Text style={[s.branchPickCity, isSel && { color: 'rgba(18,13,46,0.7)' }]}>{branch.city}</Text> : null}
                  <Text style={[s.branchPickMeta, isSel && { color: 'rgba(18,13,46,0.6)' }]}>
                    {branch.memberCount} members
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── ELIGIBLE PASTORS section ── */}
        <View style={{ padding: 16, paddingTop: 20 }}>
          <View style={[s.sectionHeader, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={s.sectionAccent} />
              <Text style={s.sectionTitle}>Eligible Pastors</Text>
            </View>
            <View style={s.filterBtn}>
              <Ionicons name="filter" size={14} color={C.textGray} />
              <Text style={s.filterBtnText}>Filter</Text>
            </View>
          </View>

          {/* Search */}
          <View style={s.searchBar}>
            <Ionicons name="search" size={16} color={C.textGray} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search pastors..."
              placeholderTextColor={C.textGray}
            />
          </View>

          {/* Pastor list */}
          {filteredPastors.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="person-circle-outline" size={48} color={C.border} />
              <Text style={s.emptyTitle}>No pastors found</Text>
              <Text style={s.emptySub}>
                Register members with "Pastor" or "Minister" status to see them here.
              </Text>
            </View>
          ) : (
            filteredPastors.map((pastor) => (
              <EligiblePastorCard
                key={`${pastor._source}-${pastor.id}`}
                pastor={pastor}
                isSelected={selectedPastor?.id === pastor.id}
                branchMap={branchMap}
                onSelect={() => setSelectedPastor(
                  selectedPastor?.id === pastor.id ? null : pastor,
                )}
              />
            ))
          )}

          {/* "Search more personnel" placeholder (matches image 2) */}
          {filteredPastors.length > 0 && (
            <View style={s.morePlaceholder}>
              <Ionicons name="person-search-outline" size={28} color={C.border} />
              <Text style={s.moreText}>Search more personnel...</Text>
            </View>
          )}
        </View>

        {/* ── ASSIGNMENT SUMMARY (matches image 2 bottom dark card) ── */}
        {showSummary && (
          <View style={s.summaryCard}>
            <View style={s.summaryHeader}>
              <Ionicons name="checkmark-circle" size={20} color={C.accent} />
              <Text style={s.summaryTitle}>Assignment Summary</Text>
            </View>

            <View style={s.summaryRow}>
              <View style={s.summaryRowIcon}>
                <Ionicons name="person" size={16} color={C.accent} />
              </View>
              <View>
                <Text style={s.summaryRowLabel}>Selected Pastor</Text>
                <Text style={s.summaryRowValue}>
                  {selectedPastor!.firstName} {selectedPastor!.lastName}
                </Text>
              </View>
            </View>

            <View style={s.summaryRow}>
              <View style={s.summaryRowIcon}>
                <Ionicons name="business" size={16} color={C.accent} />
              </View>
              <View>
                <Text style={s.summaryRowLabel}>Target Branch</Text>
                <Text style={s.summaryRowValue}>{targetBranch!.name}</Text>
              </View>
            </View>

            <View style={s.summaryRow}>
              <View style={s.summaryRowIcon}>
                <Ionicons name="calendar" size={16} color={C.accent} />
              </View>
              <View>
                <Text style={s.summaryRowLabel}>Effective Date</Text>
                <Text style={s.summaryRowValue}>{fmtToday()}</Text>
              </View>
            </View>

            <View style={s.summaryNotice}>
              <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={s.summaryNoticeText}>
                This assignment will update the personnel database and notify the branch.
              </Text>
            </View>

            <TouchableOpacity
              style={[s.confirmBtn, submitting && { opacity: 0.7 }]}
              onPress={handleConfirm}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color={C.dark} />
                : <Text style={s.confirmBtnText}>CONFIRM ASSIGNMENT</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => { setSelectedPastor(null); setSelectedBranch(null); }}>
              <Text style={s.cancelBtnText}>Cancel & Return</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.white },

  branchHeroCard: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', backgroundColor: C.darkCard, margin: 16, borderRadius: 18, padding: 20 },
  branchHeroLeft: { flex: 1 },
  branchHeroLabel: { fontSize: 9, fontWeight: '800', color: C.accent, letterSpacing: 1.5, marginBottom: 6 },
  branchHeroName: { fontSize: 22, fontWeight: '800', color: C.white, marginBottom: 10, lineHeight: 28 },
  branchHeroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  branchHeroCity: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  vacancyBadge: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', marginLeft: 12 },
  vacancyLine1: { fontSize: 8, fontWeight: '800', color: C.dark, letterSpacing: 1 },
  vacancyLine2: { fontSize: 11, fontWeight: '800', color: C.dark },

  branchPickCard: { backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  branchPickCardSelected: { backgroundColor: C.accent, borderColor: C.accent },
  branchPickCheck: { position: 'absolute', top: 12, right: 12 },
  branchPickName: { fontSize: 15, fontWeight: '800', color: C.textDark, marginBottom: 3, paddingRight: 28 },
  branchPickCity: { fontSize: 12, color: C.textGray, marginBottom: 2 },
  branchPickMeta: { fontSize: 11, color: C.textGray },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: C.accent },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.textDark },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  filterBtnText: { fontSize: 12, fontWeight: '700', color: C.textGray },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  searchInput: { flex: 1, fontSize: 14, color: C.textDark },

  morePlaceholder: { alignItems: 'center', gap: 6, paddingVertical: 20, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12 },
  moreText: { fontSize: 13, color: C.textGray },

  summaryCard: { backgroundColor: C.dark, margin: 16, borderRadius: 20, padding: 20 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: C.white },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14, marginBottom: 8 },
  summaryRowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(245,197,24,0.15)', alignItems: 'center', justifyContent: 'center' },
  summaryRowLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginBottom: 2 },
  summaryRowValue: { fontSize: 14, fontWeight: '800', color: C.white },
  summaryNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8, marginBottom: 20 },
  summaryNoticeText: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 16 },
  confirmBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  confirmBtnText: { fontSize: 15, fontWeight: '800', color: C.dark, letterSpacing: 0.6 },
  cancelBtn: { alignItems: 'center', paddingVertical: 6 },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },

  empty: { alignItems: 'center', gap: 8, paddingTop: 40, paddingBottom: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.textDark },
  emptySub: { fontSize: 13, color: C.textGray, textAlign: 'center', paddingHorizontal: 20 },
});

const c = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1.5, borderColor: 'transparent' },
  cardSelected: { borderColor: C.accent },
  checkmark: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  avatarRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, borderColor: C.border, padding: 2, alignItems: 'center', justifyContent: 'center' },
  avatarRingSelected: { borderColor: C.accent },
  avatar: { flex: 1, borderRadius: 26, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: C.accent },
  name: { fontSize: 16, fontWeight: '800', color: C.textDark, marginBottom: 6 },
  expBadge: { alignSelf: 'flex-start', backgroundColor: C.dark, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  expText: { fontSize: 9, fontWeight: '800', color: C.accent, letterSpacing: 0.5 },
  infoRows: { gap: 6, marginBottom: 14 },
  infoRow: { flexDirection: 'row', gap: 8 },
  infoLabel: { fontSize: 12, color: C.textGray, width: 120 },
  infoValue: { fontSize: 12, fontWeight: '700', color: C.textDark, flex: 1 },
  viewProfileBtn: { borderWidth: 1.5, borderColor: C.dark, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  viewProfileBtnSelected: { backgroundColor: C.accent, borderColor: C.accent },
  viewProfileText: { fontSize: 13, fontWeight: '800', color: C.dark, letterSpacing: 0.3 },
});
