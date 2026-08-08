import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl, TextInput, Linking
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CONTRACT_STATUS_LABEL, CONTRACT_STATUS_COLOR, getInitials,
  monthsBetween, monthsElapsed, getUrgencyColor
} from '@/utils/contract';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

type ContractStatus = 'Active' | 'Draft' | 'Expired' | 'Cancelled';
type FilterStatus = 'all' | ContractStatus;

interface Tenant {
  contractId: number;
  partnerId: string;
  name: string;
  initials: string;
  phone: string;
  email: string;
  spaceId: number;
  space: string;
  spaceAddress: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  status: ContractStatus;
  isLessor: boolean;
}

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'Active', label: 'Đã ký' },
  { key: 'Draft', label: 'Chưa ký' },
  { key: 'Expired', label: 'Hết hạn' },
  { key: 'Cancelled', label: 'Đã huỷ' },
];

const normalizeList = (data: any) => (Array.isArray(data) ? data : data?.data || data?.items || []);

const statusOrder: Record<ContractStatus, number> = { Active: 0, Draft: 1, Expired: 2, Cancelled: 3 };

export default function MyContractsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('portal_token');
      const currentUserId = await AsyncStorage.getItem('current_user_id');
      if (!token || !currentUserId) {
        router.replace('/login');
        return;
      }

      const [asLessorRes, asLesseeRes, spaceRes] = await Promise.all([
        fetch(`${API_BASE}/api/Contract/GetAll?LessorId=${encodeURIComponent(currentUserId)}`, {
          headers: { Authorization: `Bearer ${token}`, accept: '*/*' },
        }),
        fetch(`${API_BASE}/api/Contract/GetAll?LesseeId=${encodeURIComponent(currentUserId)}`, {
          headers: { Authorization: `Bearer ${token}`, accept: '*/*' },
        }),
        fetch(`${API_BASE}/api/Space/GetAll?OwnerId=${encodeURIComponent(currentUserId)}`, {
          headers: { Authorization: `Bearer ${token}`, accept: '*/*' },
        }),
      ]);

      const asLessorContracts = asLessorRes.ok ? normalizeList(await asLessorRes.json()) : [];
      const asLesseeContracts = asLesseeRes.ok ? normalizeList(await asLesseeRes.json()) : [];
      const spaces = spaceRes.ok ? normalizeList(await spaceRes.json()) : [];
      const spaceMap = new Map<number, any>(spaces.map((s: any) => [s.id ?? s.Id, s]));

      const contractMap = new Map<number, any>();
      [...asLessorContracts, ...asLesseeContracts].forEach((c: any) => {
        contractMap.set(c.id ?? c.Id, c);
      });
      const contracts = Array.from(contractMap.values());

      const uniquePartnerIds = Array.from(
        new Set(
          contracts.map((c: any) => {
            const lessorId = c.lessorId ?? c.LessorId;
            const lesseeId = c.lesseeId ?? c.LesseeId;
            return String(lessorId) === String(currentUserId) ? lesseeId : lessorId;
          }).filter(Boolean)
        )
      );
      const userEntries = await Promise.all(
        uniquePartnerIds.map(async (id) => {
          try {
            const res = await fetch(`${API_BASE}/api/User/${id}`, {
              headers: { Authorization: `Bearer ${token}`, accept: '*/*' },
            });
            if (!res.ok) return [id, null] as const;
            return [id, await res.json()] as const;
          } catch {
            return [id, null] as const;
          }
        })
      );
      const userMap = new Map(userEntries);

      const missingSpaceIds = Array.from(
        new Set(
          contracts
            .map((c: any) => c.spaceId ?? c.SpaceId)
            .filter((id: any) => id != null && !spaceMap.has(id))
        )
      );
      if (missingSpaceIds.length > 0) {
        const extraSpaceEntries = await Promise.all(
          missingSpaceIds.map(async (id) => {
            try {
              const res = await fetch(`${API_BASE}/api/Space/GetById${id}`, {
                headers: { Authorization: `Bearer ${token}`, accept: '*/*' },
              });
              if (!res.ok) return [id, null] as const;
              return [id, await res.json()] as const;
            } catch {
              return [id, null] as const;
            }
          })
        );
        extraSpaceEntries.forEach(([id, space]) => {
          if (space) spaceMap.set(id, space);
        });
      }

      const list: Tenant[] = contracts.map((c: any) => {
        const lessorId = c.lessorId ?? c.LessorId;
        const lesseeId = c.lesseeId ?? c.LesseeId;
        const isLessor = String(lessorId) === String(currentUserId);
        const partnerId = isLessor ? lesseeId : lessorId;
        const spaceId = c.spaceId ?? c.SpaceId;
        const user = userMap.get(partnerId);
        const space = spaceMap.get(spaceId);
        const fallbackName = isLessor ? `Người thuê #${partnerId}` : `Chủ nhà #${partnerId}`;
        const name = user?.profileFullName || user?.userName || fallbackName;

        return {
          contractId: c.id ?? c.Id,
          partnerId,
          name,
          initials: getInitials(name),
          phone: user?.phoneNumber || '',
          email: user?.email || '',
          spaceId,
          space: space?.name || `Mặt bằng #${spaceId}`,
          spaceAddress: space?.address || 'Chưa cập nhật địa chỉ',
          startDate: c.startDate ?? c.StartDate,
          endDate: c.endDate ?? c.EndDate,
          monthlyRent: c.price ?? c.Price ?? 0,
          status: (c.status ?? c.Status ?? 'Draft') as ContractStatus,
          isLessor,
        };
      });

      list.sort((a, b) => b.contractId - a.contractId);
      setTenants(list);
    } catch (err) {
      console.error('Lỗi tải danh sách người thuê:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchTenants();
    }, [fetchTenants])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTenants();
  };

  const filtered = tenants
    .filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.space.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filterStatus === 'all' || t.status === filterStatus;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      const groupDiff = statusOrder[a.status] - statusOrder[b.status];
      if (groupDiff !== 0) return groupDiff;
      if (a.status === 'Active') {
        const aTotal = monthsBetween(a.startDate, a.endDate);
        const bTotal = monthsBetween(b.startDate, b.endDate);
        const aRemaining = aTotal - Math.min(aTotal, monthsElapsed(a.startDate));
        const bRemaining = bTotal - Math.min(bTotal, monthsElapsed(b.startDate));
        if (aRemaining !== bRemaining) return aRemaining - bRemaining;
      }
      return b.contractId - a.contractId;
    });

  const activeTenants = tenants.filter((t) => t.status === 'Active');
  const totalRevenue = activeTenants.reduce((sum, t) => sum + t.monthlyRent, 0);
  const needsAttentionCount = tenants.filter((t) => t.status === 'Draft' || t.status === 'Cancelled').length;

  const renderItem = ({ item }: { item: Tenant }) => {
    const total = monthsBetween(item.startDate, item.endDate);
    const elapsed = Math.min(total, monthsElapsed(item.startDate));
    const remaining = Math.max(0, total - elapsed);
    const remainingRatio = total > 0 ? remaining / total : 1;
    const urgencyColor = getUrgencyColor(remainingRatio, item.status);
    const progressPct = Math.max(total > 0 ? (elapsed / total) * 100 : 0, 3);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: `hsl(${item.contractId * 60}, 55%, 45%)` }]}>
              <Text style={styles.avatarText}>{item.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.tenantName} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.roleBadge, item.isLessor ? styles.roleBadgeLessor : styles.roleBadgeLessee]}>
                  <Text style={[styles.roleBadgeText, { color: item.isLessor ? '#7C3AED' : '#0891B2' }]}>
                    {item.isLessor ? 'Bên cho thuê' : 'Bên thuê'}
                  </Text>
                </View>
              </View>
              <View style={styles.spaceRow}>
                <Feather name="home" size={12} color="#6B7280" />
                <Text style={styles.spaceText} numberOfLines={1}>{item.space}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${CONTRACT_STATUS_COLOR[item.status]}20` }]}>
            <Text style={[styles.statusText, { color: CONTRACT_STATUS_COLOR[item.status] }]}>
              {CONTRACT_STATUS_LABEL[item.status]}
            </Text>
          </View>
        </View>



        <View style={styles.infoRow}>
          <Feather name="trending-up" size={13} color="#00A67E" />
          <Text style={styles.infoRent}>{item.monthlyRent.toLocaleString('vi-VN')}₫</Text>
          <Text style={styles.infoDot}>•</Text>
          <Feather name="map-pin" size={12} color="#6B7280" />
          <Text style={styles.infoAddress} numberOfLines={1}>{item.spaceAddress}</Text>
        </View>

        <View style={styles.contactRow}>
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => item.phone && Linking.openURL(`tel:${item.phone}`)}
            disabled={!item.phone}
          >
            <Feather name="phone" size={13} color={item.phone ? '#374151' : '#D1D5DB'} />
            <Text style={[styles.contactText, !item.phone && { color: '#D1D5DB' }]}>{item.phone || 'Chưa có SĐT'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => item.email && Linking.openURL(`mailto:${item.email}`)}
            disabled={!item.email}
          >
            <Feather name="mail" size={13} color={item.email ? '#374151' : '#D1D5DB'} />
            <Text style={[styles.contactText, !item.email && { color: '#D1D5DB' }]} numberOfLines={1}>{item.email || 'Chưa có email'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.contractBtn}
          onPress={() => router.push(`/contract/${item.contractId}`)}
        >
          <Feather name="file-text" size={14} color="#00A67E" />
          <Text style={styles.contractBtnText}>Xem hợp đồng</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Người thuê & Hợp đồng</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{tenants.length}</Text>
          <Text style={styles.summaryLabel}>Tổng người thuê</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: '#00A67E' }]}>{(totalRevenue / 1000000).toFixed(1)}tr₫</Text>
          <Text style={styles.summaryLabel}>Doanh thu/tháng</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: '#D97706' }]}>{needsAttentionCount}</Text>
          <Text style={styles.summaryLabel}>Cần chú ý</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo tên hoặc mặt bằng..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.tabsWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.tab, filterStatus === f.key && styles.tabActive]}
              onPress={() => setFilterStatus(f.key)}
            >
              <Text style={[styles.tabText, filterStatus === f.key && styles.tabTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#00A67E" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="users" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Chưa có người thuê nào</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.contractId)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#00A67E']} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0D1117',
    borderBottomWidth: 1, borderBottomColor: '#0D1117'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 8, backgroundColor: '#fff' },
  summaryCard: {
    flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6'
  },
  summaryValue: { fontSize: 17, fontWeight: 'bold', color: '#111827' },
  summaryLabel: { fontSize: 10, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F3F4F6', marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    paddingHorizontal: 12, height: 40, borderRadius: 10
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  tabsWrap: { backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: '#00A67E' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#fff' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#6B7280' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 14 },
  avatarWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tenantName: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  roleBadgeLessor: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  roleBadgeLessee: { backgroundColor: '#ECFEFF', borderColor: '#A5F3FC' },
  roleBadgeText: { fontSize: 10, fontWeight: 'bold' },
  spaceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  spaceText: { fontSize: 12, color: '#6B7280', flexShrink: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  progressSection: { marginBottom: 12 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: '600' },
  progressRemaining: { fontSize: 12, fontWeight: 'bold' },
  progressTrack: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  infoRent: { fontSize: 13, fontWeight: 'bold', color: '#00A67E' },
  infoDot: { color: '#D1D5DB', fontSize: 12 },
  infoAddress: { fontSize: 12, color: '#6B7280', flex: 1 },
  contactRow: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, marginBottom: 10 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  contactText: { fontSize: 12, color: '#374151', flexShrink: 1 },
  contractBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#ECFDF5', borderRadius: 8, paddingVertical: 10
  },
  contractBtnText: { fontSize: 13, fontWeight: 'bold', color: '#00A67E' },
});
