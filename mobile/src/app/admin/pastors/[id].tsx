import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../../constants/theme';

const ROLE_LABELS: Record<string, string> = {
  SENIOR_PASTOR: 'SENIOR REGIONAL PASTOR',
  BRANCH_PASTOR: 'BRANCH PASTOR',
  senior_pastor: 'SENIOR REGIONAL PASTOR',
  branch_pastor: 'BRANCH PASTOR',
};

function initials(name: string) {
  return name.split(' ').map((n) => n[0] ?? '').join('').toUpperCase().slice(0, 2);
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <View style={[p.statCard, accent && p.statCardAccent]}>
      <Text style={[p.statCardLabel, accent && { color: 'rgba(18,13,46,0.6)' }]}>{label}</Text>
      <Text style={[p.statCardValue, accent && { color: C.dark }]}>{value}</Text>
      {sub && <Text style={[p.statCardSub, accent && { color: 'rgba(18,13,46,0.55)' }]}>{sub}</Text>}
    </View>
  );
}

export default function PastorProfileScreen() {
  const router = useRouter();
  const {
    id, pastorName, pastorEmail, pastorPhone,
    pastorRole, branchName, branchCity, memberCount, workerCount,
  } = useLocalSearchParams<{
    id: string; pastorName: string; pastorEmail: string; pastorPhone: string;
    pastorRole: string; churchId: string; branchName: string; branchCity: string;
    memberCount: string; workerCount: string;
  }>();

  const roleLabel = ROLE_LABELS[pastorRole] ?? 'BRANCH PASTOR';
  const hasBranch = !!branchName;
  const members = parseInt(memberCount ?? '0', 10);
  const workers = parseInt(workerCount ?? '0', 10);
  const workerPct = members > 0 ? Math.round((workers / members) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.dark }}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark} />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Hero section */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: C.dark }}>
          <View style={p.heroHeader}>
            <TouchableOpacity onPress={() => router.back()} style={p.backBtn}>
              <Ionicons name="arrow-back" size={22} color={C.white} />
            </TouchableOpacity>
          </View>

          <View style={p.heroBody}>
            {/* Large avatar with gold ring */}
            <View style={p.heroAvatarRing}>
              <View style={p.heroAvatar}>
                <Text style={p.heroAvatarText}>{initials(pastorName ?? 'UN')}</Text>
              </View>
            </View>

            {/* Role badge */}
            <View style={p.roleChip}>
              <Text style={p.roleChipText}>{roleLabel}</Text>
            </View>

            <Text style={p.heroName}>{pastorName}</Text>
            <Text style={p.heroEmail}>{pastorEmail}</Text>
          </View>

          {/* Action buttons */}
          <View style={p.actionRow}>
            <TouchableOpacity
              style={p.assignBtn}
              onPress={() => router.push({
                pathname: '/admin/pastors/assign',
                params: { pastorId: id, pastorName, mode: 'transfer' },
              } as any)}
              activeOpacity={0.85}
            >
              <Text style={p.assignBtnText}>ASSIGN TRANSFER</Text>
            </TouchableOpacity>
          </View>

          <View style={p.contactRow}>
            {pastorPhone ? (
              <TouchableOpacity style={p.contactBtn} onPress={() => Linking.openURL(`tel:${pastorPhone}`)}>
                <Ionicons name="call-outline" size={16} color={C.white} />
                <Text style={p.contactBtnText}>Contact</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={p.contactBtn} onPress={() => Linking.openURL(`mailto:${pastorEmail}`)}>
              <Ionicons name="mail-outline" size={16} color={C.white} />
              <Text style={p.contactBtnText}>Email</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Content */}
        <View style={{ backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 }}>

          {/* Assigned Branch */}
          <View style={p.branchCard}>
            <Text style={p.branchCardLabel}>ASSIGNED BRANCH</Text>
            {hasBranch ? (
              <>
                <Text style={p.branchCardName}>{branchName}</Text>
                {branchCity ? (
                  <View style={p.branchLocation}>
                    <Ionicons name="location-outline" size={13} color={C.accent} />
                    <Text style={p.branchLocationText}>{branchCity}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={p.branchUnassigned}>
                <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" />
                <Text style={p.branchUnassignedText}>Not yet assigned to a branch</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          {hasBranch && (
            <View style={p.statsRow}>
              <StatCard label="CONGREGATION" value={members.toLocaleString()} sub="Total members" />
              <StatCard
                label="WORKER FORCE"
                value={`${workerPct}%`}
                sub={`${workers} active workers`}
                accent
              />
            </View>
          )}

          {/* Ministry info */}
          <View style={p.infoCard}>
            <View style={p.infoRow}>
              <Ionicons name="mail-outline" size={18} color={C.textGray} />
              <View style={{ flex: 1 }}>
                <Text style={p.infoLabel}>Email Address</Text>
                <Text style={p.infoValue}>{pastorEmail}</Text>
              </View>
            </View>
            {pastorPhone ? (
              <View style={[p.infoRow, { borderTopWidth: 1, borderTopColor: C.bg }]}>
                <Ionicons name="call-outline" size={18} color={C.textGray} />
                <View style={{ flex: 1 }}>
                  <Text style={p.infoLabel}>Phone Number</Text>
                  <Text style={p.infoValue}>{pastorPhone}</Text>
                </View>
              </View>
            ) : null}
            <View style={[p.infoRow, { borderTopWidth: 1, borderTopColor: C.bg }]}>
              <Ionicons name="ribbon-outline" size={18} color={C.textGray} />
              <View style={{ flex: 1 }}>
                <Text style={p.infoLabel}>Role</Text>
                <Text style={p.infoValue}>{roleLabel}</Text>
              </View>
            </View>
          </View>

          {/* Reassign CTA */}
          <TouchableOpacity
            style={p.reassignCard}
            onPress={() => router.push({
              pathname: '/admin/pastors/assign',
              params: { pastorId: id, pastorName, mode: 'transfer' },
            } as any)}
            activeOpacity={0.8}
          >
            <View style={p.reassignIcon}>
              <Ionicons name="swap-horizontal" size={20} color={C.dark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={p.reassignTitle}>Branch Transfer</Text>
              <Text style={p.reassignSub}>Reassign this pastor to a different branch</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textGray} />
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

const p = StyleSheet.create({
  heroHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  backBtn: { padding: 4 },
  heroBody: { alignItems: 'center', paddingTop: 12, paddingBottom: 20, paddingHorizontal: 16 },
  heroAvatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: C.accent, padding: 3, marginBottom: 16 },
  heroAvatar: { flex: 1, borderRadius: 47, backgroundColor: C.darkCard, alignItems: 'center', justifyContent: 'center' },
  heroAvatarText: { fontSize: 28, fontWeight: '800', color: C.accent },
  roleChip: { backgroundColor: C.darkCard, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  roleChipText: { fontSize: 10, fontWeight: '800', color: C.accent, letterSpacing: 1 },
  heroName: { fontSize: 26, fontWeight: '800', color: C.white, textAlign: 'center', marginBottom: 6 },
  heroEmail: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },

  actionRow: { paddingHorizontal: 16, marginBottom: 10 },
  assignBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  assignBtnText: { fontSize: 14, fontWeight: '800', color: C.dark, letterSpacing: 0.6 },

  contactRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 4 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', paddingVertical: 11 },
  contactBtnText: { fontSize: 13, fontWeight: '700', color: C.white },

  // Branch card
  branchCard: { backgroundColor: C.dark, borderRadius: 16, padding: 18, marginBottom: 14 },
  branchCardLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.45)', letterSpacing: 1.2, marginBottom: 8 },
  branchCardName: { fontSize: 24, fontWeight: '800', color: C.white, marginBottom: 6 },
  branchLocation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  branchLocationText: { fontSize: 13, color: C.accent, fontWeight: '600' },
  branchUnassigned: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  branchUnassignedText: { fontSize: 14, color: '#F59E0B', fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  statCardAccent: { backgroundColor: C.accent },
  statCardLabel: { fontSize: 9, fontWeight: '800', color: C.textGray, letterSpacing: 0.8, marginBottom: 8 },
  statCardValue: { fontSize: 28, fontWeight: '800', color: C.textDark },
  statCardSub: { fontSize: 11, color: C.textGray, marginTop: 4 },

  // Info card
  infoCard: { backgroundColor: C.white, borderRadius: 16, marginBottom: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  infoLabel: { fontSize: 10, fontWeight: '700', color: C.textGray, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: C.textDark },

  // Reassign card
  reassignCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  reassignIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  reassignTitle: { fontSize: 14, fontWeight: '700', color: C.textDark },
  reassignSub: { fontSize: 12, color: C.textGray, marginTop: 2 },
});
