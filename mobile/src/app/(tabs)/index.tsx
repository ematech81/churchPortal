import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/auth.store';
import { getPinSetupSkipped } from '../../utils/pin-session';
import PinSetupModal from '../../components/pin/PinSetupModal';

const C = {
  dark: '#120D2E',
  darkCard: '#1E1650',
  accent: '#F5C518',
  accentFaint: 'rgba(245,197,24,0.15)',
  bg: '#F2F2F7',
  white: '#FFFFFF',
  textDark: '#120D2E',
  textGray: '#8888A0',
};

const isPastor = (role: string) =>
  role === 'senior_pastor' || role === 'branch_pastor';

const ALL_CLUSTERS = [
  { icon: 'people',      title: 'People &\nMembership', sub: 'Directory, Families, Stats',    route: '/members',        pastorOnly: false },
  { icon: 'trending-up', title: 'Follow-up\nEngine',    sub: 'Converts, Workers, Tasks',       route: '/follow-up',      pastorOnly: false },
  { icon: 'checkbox',    title: 'Attendance',            sub: 'Check-in, Trends, Reports',      route: '/attendance',     pastorOnly: false },
  { icon: 'home',        title: 'Ministry\nGroups',      sub: 'Cell Groups, Volunteers, Rota',  route: null,              pastorOnly: false },
  { icon: 'wallet',      title: 'Finance',               sub: 'Tithes, Giving, Statements',     route: '/finance',        pastorOnly: true  },
  { icon: 'book',        title: 'Spiritual\nHub',        sub: 'Sermons, Prayer, Events',        route: null,              pastorOnly: false },
  { icon: 'chatbubbles', title: 'Communication',         sub: 'WhatsApp, SMS, Inbox',            route: '/communication',  pastorOnly: false },
  { icon: 'settings',    title: 'Administration',        sub: 'Dashboard, Branches, Roles',     route: '/admin',          pastorOnly: true  },
];

const ACTIVITY = [
  { icon: 'play-circle',   title: 'Sermon: Faith for the New Year', sub: 'Accessed 2 hours ago',    iconBg: C.accent,    iconColor: C.dark  },
  { icon: 'person-circle', title: 'Member: John Doe',               sub: 'Profile edited yesterday', iconBg: C.darkCard,  iconColor: C.white },
  { icon: 'document-text', title: 'Report: Monthly Cell Growth',    sub: 'Generated 3 days ago',    iconBg: C.accent,    iconColor: C.dark  },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = (user?.role ?? '').toLowerCase();
  const userIsPastor = isPastor(role);

  const clusters = ALL_CLUSTERS.filter((c) => !c.pastorOnly || userIsPastor);

  // Show PIN setup modal for pastors who haven't set a PIN yet and haven't dismissed it this session
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    if (userIsPastor && user?.hasPin === false && !getPinSetupSkipped()) {
      const timer = setTimeout(() => setShowPinModal(true), 600);
      return () => clearTimeout(timer);
    }
  }, [userIsPastor, user?.hasPin]);

  return (
    <View style={{ flex: 1, backgroundColor: C.dark }}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark} />
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.dark }}>
        <View style={s.header}>
          <TouchableOpacity style={s.headerBtn}>
            <Ionicons name="menu" size={26} color={C.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Kingdom Portal</Text>
          <TouchableOpacity>
            <View style={s.avatar}>
              <Ionicons name="person" size={18} color={C.white} />
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Search */}
        <View style={s.searchWrap}>
          <View style={s.searchBar}>
            <Ionicons name="search" size={18} color={C.textGray} />
            <Text style={s.searchText}>Search for people, groups, or tool</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <View style={s.statIconRing}>
              <Ionicons name="people" size={22} color={C.accent} />
            </View>
            <View>
              <Text style={s.statLabel}>TOTAL MEMBERS</Text>
              <Text style={s.statValue}>1,284</Text>
            </View>
          </View>
          <View style={s.statCard}>
            <View style={s.statIconRing}>
              <Ionicons name="person-add" size={22} color={C.accent} />
            </View>
            <View>
              <Text style={s.statLabel}>NEW TODAY</Text>
              <Text style={s.statValue}>12</Text>
            </View>
          </View>
        </View>

        {/* Functional Clusters */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Functional Clusters</Text>
          <View style={s.grid}>
            {clusters.map((cluster) => (
              <TouchableOpacity
                key={cluster.title}
                style={s.clusterCard}
                activeOpacity={0.75}
                onPress={() => cluster.route && router.push(cluster.route as any)}
              >
                <View style={s.clusterIcon}>
                  <Ionicons name={cluster.icon as any} size={24} color={C.white} />
                </View>
                <Text style={s.clusterTitle}>{cluster.title}</Text>
                <Text style={s.clusterSub}>{cluster.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Activity</Text>
          {ACTIVITY.map((item) => (
            <TouchableOpacity key={item.title} style={s.activityRow} activeOpacity={0.75}>
              <View style={[s.activityIcon, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.activityTitle}>{item.title}</Text>
                <Text style={s.activitySub}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textGray} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <PinSetupModal
        visible={showPinModal}
        onDismiss={() => setShowPinModal(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerBtn: { padding: 4 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 0.3,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.darkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchText: { fontSize: 14, color: C.textGray },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: C.darkCard,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accentFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: { fontSize: 9, color: '#8888AA', fontWeight: '600', letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: '800', color: C.white, marginTop: 2 },
  section: { paddingHorizontal: 16, paddingTop: 22 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textDark,
    marginBottom: 14,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  clusterCard: {
    width: '47%',
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  clusterIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.darkCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  clusterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textDark,
    lineHeight: 20,
    marginBottom: 4,
  },
  clusterSub: { fontSize: 11, color: C.textGray, lineHeight: 16 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  activityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: { fontSize: 13, fontWeight: '600', color: C.textDark },
  activitySub: { fontSize: 11, color: C.textGray, marginTop: 2 },
});
