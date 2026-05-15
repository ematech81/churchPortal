import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  StatusBar, ActivityIndicator, Image, Linking, Alert,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { C } from '../../constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemberDetail {
  id: string;
  memberId: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  maritalStatus: string | null;
  occupation: string | null;
  photoUrl: string | null;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  preferredLanguage: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  status: string;
  baptismStatus: string | null;
  baptismDate: string | null;
  holyGhostBaptism: boolean;
  salvationDate: string | null;
  membershipDate: string | null;
  membershipCategory: string | null;
  churchRole: string | null;
  pastoralPosition: string | null;
  customRole: string | null;
  departmentName: string | null;
  departmentRole: string | null;
  parentGuardianName: string | null;
  parentGuardianPhone: string | null;
  tags: string[];
  whatsappOptIn: boolean;
  smsOptIn: boolean;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  member:      { bg: '#DCFCE7', text: '#166534' },
  worker:      { bg: '#EDE9FE', text: '#5B21B6' },
  visitor:     { bg: '#FEF9C3', text: '#854D0E' },
  first_timer: { bg: '#DBEAFE', text: '#1E40AF' },
  minister:    { bg: '#FEF2F2', text: '#991B1B' },
  new_convert: { bg: '#CCFBF1', text: '#0F766E' },
  backslidden: { bg: '#FEF3C7', text: '#92400E' },
};

function statusColor(status: string) {
  return STATUS_COLORS[status.toLowerCase()] ?? { bg: C.bg, text: C.textGray };
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function humanize(val: string | null) {
  if (!val) return null;
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function initials(m: MemberDetail) {
  return `${m.firstName[0] ?? ''}${m.lastName[0] ?? ''}`.toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: any; title: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionIconWrap}>
        <Ionicons name={icon} size={15} color={C.accent} />
      </View>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={s.divider} />;
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MemberDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await api.get(`/members/${id}`);
      setMember(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Could not load member details.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const callPhone = (phone: string) => Linking.openURL(`tel:${phone}`);
  const openWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${clean}`);
  };

  const handleDelete = () => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member?.firstName} ${member?.lastName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/members/${id}`);
              router.back();
            } catch {
              Alert.alert('Error', 'Could not remove member. Please try again.');
            }
          },
        },
      ],
    );
  };

  // ── Loading / Error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.dark }}>
        <StatusBar barStyle="light-content" backgroundColor={C.dark} />
        <SafeAreaView edges={['top']} style={{ backgroundColor: C.dark }}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={22} color={C.white} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Member Profile</Text>
            <View style={{ width: 34 }} />
          </View>
        </SafeAreaView>
        <View style={[s.centered, { backgroundColor: C.bg }]}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      </View>
    );
  }

  if (error || !member) {
    return (
      <View style={{ flex: 1, backgroundColor: C.dark }}>
        <StatusBar barStyle="light-content" backgroundColor={C.dark} />
        <SafeAreaView edges={['top']} style={{ backgroundColor: C.dark }}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={22} color={C.white} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Member Profile</Text>
            <View style={{ width: 34 }} />
          </View>
        </SafeAreaView>
        <View style={[s.centered, { backgroundColor: C.bg }]}>
          <Ionicons name="alert-circle-outline" size={48} color={C.error} />
          <Text style={s.errorTitle}>Failed to load</Text>
          <Text style={s.errorSub}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load}>
            <Text style={s.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const col = statusColor(member.status);
  const fullName = [member.firstName, member.middleName, member.lastName].filter(Boolean).join(' ');

  return (
    <View style={{ flex: 1, backgroundColor: C.dark }}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark} />

      {/* Header bar */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.dark }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Member Profile</Text>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/members/edit', params: { id } } as any)}
            style={s.editBtn}
          >
            <Ionicons name="create-outline" size={22} color={C.accent} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Hero card */}
        <View style={s.heroCard}>
          {/* Avatar / photo */}
          <View style={s.avatarWrap}>
            {member.photoUrl ? (
              <Image source={{ uri: member.photoUrl }} style={s.avatarImage} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarText}>{initials(member)}</Text>
              </View>
            )}
          </View>

          <Text style={s.heroName}>{fullName}</Text>

          {member.memberId && (
            <Text style={s.heroId}>{member.memberId}</Text>
          )}

          <View style={[s.statusBadge, { backgroundColor: col.bg }]}>
            <Text style={[s.statusText, { color: col.text }]}>
              {member.status.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>

          {member.churchRole && (
            <View style={s.rolePill}>
              <Ionicons name="ribbon-outline" size={12} color={C.accent} />
              <Text style={s.rolePillText}>{humanize(member.churchRole)}</Text>
            </View>
          )}

          {/* Quick action buttons */}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={() => callPhone(member.phone)}>
              <Ionicons name="call" size={20} color={C.dark} />
              <Text style={s.actionBtnText}>Call</Text>
            </TouchableOpacity>

            {member.whatsappOptIn && (
              <TouchableOpacity style={[s.actionBtn, s.actionBtnGreen]} onPress={() => openWhatsApp(member.phone)}>
                <Ionicons name="logo-whatsapp" size={20} color={C.white} />
                <Text style={[s.actionBtnText, { color: C.white }]}>WhatsApp</Text>
              </TouchableOpacity>
            )}

            {member.email && (
              <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(`mailto:${member.email}`)}>
                <Ionicons name="mail" size={20} color={C.dark} />
                <Text style={s.actionBtnText}>Email</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Contact & Personal */}
        <View style={s.section}>
          <SectionHeader icon="person-outline" title="Personal Information" />
          <InfoRow label="Phone" value={member.phone} />
          {member.alternatePhone && <InfoRow label="Alt. Phone" value={member.alternatePhone} />}
          <InfoRow label="Email" value={member.email} />
          <InfoRow label="Gender" value={humanize(member.gender)} />
          <InfoRow label="Date of Birth" value={formatDate(member.dateOfBirth)} />
          <InfoRow label="Marital Status" value={humanize(member.maritalStatus)} />
          <InfoRow label="Occupation" value={member.occupation} />
          <InfoRow label="Language" value={member.preferredLanguage} />
        </View>

        {/* Address */}
        {(member.address || member.city || member.state) && (
          <View style={s.section}>
            <SectionHeader icon="location-outline" title="Address" />
            {member.address && <InfoRow label="Street" value={member.address} />}
            {member.city && <InfoRow label="City" value={member.city} />}
            {member.state && <InfoRow label="State" value={member.state} />}
          </View>
        )}

        {/* Spiritual Status */}
        <View style={s.section}>
          <SectionHeader icon="heart-outline" title="Spiritual Status" />
          <InfoRow label="Membership Category" value={humanize(member.membershipCategory)} />
          <InfoRow label="Date Joined" value={formatDate(member.membershipDate)} />
          <InfoRow label="Salvation Date" value={formatDate(member.salvationDate)} />
          <InfoRow label="Baptism Status" value={humanize(member.baptismStatus)} />
          {member.baptismDate && <InfoRow label="Baptism Date" value={formatDate(member.baptismDate)} />}
          {member.holyGhostBaptism && (
            <View style={s.boolRow}>
              <Ionicons name="flame" size={14} color="#F97316" />
              <Text style={s.boolText}>Received Holy Ghost Baptism</Text>
            </View>
          )}
        </View>

        {/* Church Role & Department */}
        <View style={s.section}>
          <SectionHeader icon="ribbon-outline" title="Church Role & Department" />
          <InfoRow label="Church Role" value={humanize(member.churchRole)} />
          {member.pastoralPosition && <InfoRow label="Pastoral Position" value={humanize(member.pastoralPosition)} />}
          {member.customRole && <InfoRow label="Custom Role" value={member.customRole} />}
          <InfoRow label="Department" value={member.departmentName} />
          {member.departmentRole && <InfoRow label="Dept. Role" value={member.departmentRole} />}
        </View>

        {/* Emergency Contact */}
        {(member.emergencyContactName || member.emergencyContactPhone) && (
          <View style={s.section}>
            <SectionHeader icon="medkit-outline" title="Emergency Contact" />
            <InfoRow label="Name" value={member.emergencyContactName} />
            <InfoRow label="Phone" value={member.emergencyContactPhone} />
          </View>
        )}

        {/* Children fields */}
        {(member.parentGuardianName || member.parentGuardianPhone) && (
          <View style={s.section}>
            <SectionHeader icon="people-outline" title="Parent / Guardian" />
            <InfoRow label="Name" value={member.parentGuardianName} />
            <InfoRow label="Phone" value={member.parentGuardianPhone} />
          </View>
        )}

        {/* Family Circle */}
        {Array.isArray((member.customFields as any)?.familyCircle) &&
          (member.customFields as any).familyCircle.length > 0 && (
          <View style={s.section}>
            <View style={s.familyHeader}>
              <SectionHeader icon="people-outline" title="Family Circle" />
            </View>
            {((member.customFields as any).familyCircle as Array<{ name: string; relationship: string; phone?: string }>).map((fm, i) => (
              <View key={i} style={s.familyRow}>
                <View style={s.familyAvatar}>
                  <Text style={s.familyAvatarText}>{fm.name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.familyName}>{fm.name}</Text>
                  <Text style={s.familyRelation}>{fm.relationship}</Text>
                </View>
                {fm.phone ? (
                  <TouchableOpacity onPress={() => callPhone(fm.phone!)} style={s.familyCallBtn}>
                    <Ionicons name="call" size={15} color={C.white} />
                  </TouchableOpacity>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={C.border} style={{ marginLeft: 4 }} />
              </View>
            ))}
          </View>
        )}

        {/* Tags */}
        {member.tags && member.tags.length > 0 && (
          <View style={s.section}>
            <SectionHeader icon="pricetag-outline" title="Tags" />
            <View style={s.tagsWrap}>
              {member.tags.map((tag) => (
                <View key={tag} style={s.tag}>
                  <Text style={s.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Meta */}
        <View style={s.section}>
          <SectionHeader icon="information-circle-outline" title="Record Info" />
          <InfoRow label="Registered" value={formatDate(member.createdAt)} />
          <View style={s.commPrefRow}>
            <View style={[s.commBadge, member.whatsappOptIn ? s.commOn : s.commOff]}>
              <Ionicons name="logo-whatsapp" size={12} color={member.whatsappOptIn ? '#166534' : C.textGray} />
              <Text style={[s.commBadgeText, member.whatsappOptIn ? { color: '#166534' } : { color: C.textGray }]}>
                WhatsApp {member.whatsappOptIn ? 'On' : 'Off'}
              </Text>
            </View>
            <View style={[s.commBadge, member.smsOptIn ? s.commOn : s.commOff]}>
              <Ionicons name="chatbubble-ellipses-outline" size={12} color={member.smsOptIn ? '#166534' : C.textGray} />
              <Text style={[s.commBadgeText, member.smsOptIn ? { color: '#166534' } : { color: C.textGray }]}>
                SMS {member.smsOptIn ? 'On' : 'Off'}
              </Text>
            </View>
          </View>
        </View>

        {/* Danger zone */}
        <View style={[s.section, { marginBottom: 8 }]}>
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={C.error} />
            <Text style={s.deleteBtnText}>Remove Member</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { padding: 4 },
  editBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.white },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorTitle: { fontSize: 17, fontWeight: '700', color: C.textDark, marginTop: 8 },
  errorSub: { fontSize: 13, color: C.textGray, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: C.dark, borderRadius: 10 },
  retryText: { fontSize: 14, fontWeight: '700', color: C.white },

  // Hero
  heroCard: {
    backgroundColor: C.dark, borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    alignItems: 'center', paddingTop: 24, paddingBottom: 28, paddingHorizontal: 24,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  avatarWrap: { marginBottom: 14 },
  avatarFallback: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: C.accentFaint,
    borderWidth: 3, borderColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: C.accent },
  avatarText: { fontSize: 30, fontWeight: '800', color: C.accent },
  heroName: { fontSize: 22, fontWeight: '800', color: C.white, textAlign: 'center', marginBottom: 4 },
  heroId: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(245,197,24,0.12)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 18,
  },
  rolePillText: { fontSize: 12, fontWeight: '700', color: C.accent },

  actionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9,
  },
  actionBtnGreen: { backgroundColor: '#25D366' },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: C.dark },

  // Sections
  section: {
    backgroundColor: C.white, marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionIconWrap: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: C.dark,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: C.textDark, letterSpacing: 0.3 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.bg,
  },
  infoLabel: { fontSize: 13, color: C.textGray, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '600', color: C.textDark, flex: 2, textAlign: 'right' },

  divider: { height: 1, backgroundColor: C.bg, marginVertical: 2 },

  boolRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7 },
  boolText: { fontSize: 13, fontWeight: '600', color: C.textDark },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: '600', color: C.textDark },

  familyHeader: { marginBottom: -4 },
  familyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.bg },
  familyAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' },
  familyAvatarText: { fontSize: 16, fontWeight: '800', color: C.accent },
  familyName: { fontSize: 14, fontWeight: '700', color: C.textDark },
  familyRelation: { fontSize: 12, color: C.textGray, marginTop: 1 },
  familyCallBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },

  commPrefRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  commBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  commOn: { backgroundColor: '#DCFCE7' },
  commOff: { backgroundColor: C.bg },
  commBadgeText: { fontSize: 12, fontWeight: '600' },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: C.error, borderRadius: 12, paddingVertical: 13,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: C.error },
});
