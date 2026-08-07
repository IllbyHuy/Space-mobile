import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal, FlatList
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  formatTime, CONTRACT_COLOR_PALETTE, toDateKey, isSameDay,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths,
  eachDayOfInterval, MONTH_LABELS_VI, getInitials
} from '@/utils/contract';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

interface OwnedSpace {
  id: number;
  address: string;
}

interface ContractCalendarEntry {
  effectiveDate: string;
  startDateTime: string;
  endDateTime: string;
  contractId: number;
  tenantName: string;
  businessDescription: string;
}

const normalizeList = (data: any) => (Array.isArray(data) ? data : data?.data || data?.items || []);

export default function RentalCalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const [ownedSpaces, setOwnedSpaces] = useState<OwnedSpace[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [isSpacesLoading, setIsSpacesLoading] = useState(true);
  const [isSpacePickerOpen, setIsSpacePickerOpen] = useState(false);

  const [contractEntries, setContractEntries] = useState<ContractCalendarEntry[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  const fetchOwnedSpaces = useCallback(async () => {
    setIsSpacesLoading(true);
    try {
      const token = await AsyncStorage.getItem('portal_token');
      const ownerId = await AsyncStorage.getItem('current_user_id');
      if (!token || !ownerId) {
        router.replace('/login');
        return;
      }
      const res = await fetch(`${API_BASE}/api/Space/GetAll?OwnerId=${encodeURIComponent(ownerId)}`, {
        headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
      });
      if (res.ok) {
        const data = await res.json();
        const safeData: OwnedSpace[] = normalizeList(data);
        setOwnedSpaces(safeData);
        setSelectedSpaceId((prev) => prev || (safeData[0] ? String(safeData[0].id) : ''));
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách mặt bằng:', err);
    } finally {
      setIsSpacesLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchOwnedSpaces();
  }, [fetchOwnedSpaces]);

  const fetchContractCalendar = useCallback(async (spaceId: string, monthDate: Date) => {
    if (!spaceId) {
      setContractEntries([]);
      return;
    }
    setIsCalendarLoading(true);
    try {
      const token = await AsyncStorage.getItem('portal_token');
      const from = `${toDateKey(startOfWeek(startOfMonth(monthDate)))}T00:00:00`;
      const to = `${toDateKey(endOfWeek(endOfMonth(monthDate)))}T23:59:59`;
      const res = await fetch(`${API_BASE}/api/Contract/calendar/space/${spaceId}?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
      });
      if (res.ok) {
        setContractEntries(normalizeList(await res.json()));
      } else {
        setContractEntries([]);
      }
    } catch (err) {
      console.error('Lỗi khi tải lịch hợp đồng:', err);
      setContractEntries([]);
    } finally {
      setIsCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContractCalendar(selectedSpaceId, currentMonth);
  }, [fetchContractCalendar, selectedSpaceId, currentMonth]);

  const getEntriesForDate = useCallback(
    (date: Date) => contractEntries.filter((e) => isSameDay(new Date(e.effectiveDate), date)),
    [contractEntries]
  );

  const calDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval(startOfWeek(monthStart), endOfWeek(monthEnd));
  }, [currentMonth]);

  const visibleContracts = useMemo(
    () => Array.from(new Map(contractEntries.map((c) => [c.contractId, c])).values()),
    [contractEntries]
  );
  const contractColorMap = useMemo(
    () => new Map<number, string>(visibleContracts.map((c, i) => [c.contractId, CONTRACT_COLOR_PALETTE[i % CONTRACT_COLOR_PALETTE.length]])),
    [visibleContracts]
  );
  const getContractColor = (contractId: number) => contractColorMap.get(contractId) || '#D46EF2';

  const selectedEntries = getEntriesForDate(selectedDate);
  const selectedSpace = ownedSpaces.find((s) => String(s.id) === selectedSpaceId);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch thuê mặt bằng</Text>
        <View style={{ width: 24 }} />
      </View>

      <TouchableOpacity
        style={styles.spaceSelector}
        onPress={() => setIsSpacePickerOpen(true)}
        disabled={isSpacesLoading || ownedSpaces.length === 0}
      >
        <Feather name="home" size={16} color="#00A67E" />
        <Text style={styles.spaceSelectorText} numberOfLines={1}>
          {isSpacesLoading ? 'Đang tải mặt bằng...' : ownedSpaces.length === 0 ? 'Bạn chưa có mặt bằng nào' : (selectedSpace?.address || 'Chọn mặt bằng')}
        </Text>
        <Feather name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => setCurrentMonth((m) => addMonths(m, -1))} style={styles.monthNavBtn}>
            <Feather name="chevron-left" size={18} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTH_LABELS_VI[currentMonth.getMonth()]} {currentMonth.getFullYear()}</Text>
          <TouchableOpacity onPress={() => setCurrentMonth((m) => addMonths(m, 1))} style={styles.monthNavBtn}>
            <Feather name="chevron-right" size={18} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.weekdaysRow}>
          {WEEKDAYS.map((wd) => (
            <Text key={wd} style={styles.weekdayLabel}>{wd}</Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calDays.map((day) => {
            const dayEntries = getEntriesForDate(day);
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const isToday = isSameDay(day, new Date());

            return (
              <TouchableOpacity
                key={day.toISOString()}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isToday && !isSelected && styles.dayCellToday,
                ]}
                onPress={() => setSelectedDate(day)}
              >
                <Text style={[
                  styles.dayNum,
                  !isCurrentMonth && styles.dayNumOther,
                  isSelected && styles.dayNumSelected,
                ]}>
                  {day.getDate()}
                </Text>
                {dayEntries.length > 0 && (
                  <View style={styles.dayDots}>
                    {dayEntries.slice(0, 3).map((e) => (
                      <View key={e.contractId} style={[styles.dot, { backgroundColor: getContractColor(e.contractId) }]} />
                    ))}
                    {dayEntries.length > 3 && <Text style={styles.dayMore}>+{dayEntries.length - 3}</Text>}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.detailPanel}>
          <Text style={styles.detailDate}>
            {selectedDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
          </Text>

          {isCalendarLoading ? (
            <ActivityIndicator color="#00A67E" style={{ marginTop: 20 }} />
          ) : selectedEntries.length === 0 ? (
            <View style={styles.emptyDetail}>
              <Feather name="info" size={24} color="#D1D5DB" />
              <Text style={styles.emptyDetailText}>Không có lịch thuê trong ngày này.</Text>
            </View>
          ) : (
            selectedEntries.map((entry) => {
              const color = getContractColor(entry.contractId);
              return (
                <TouchableOpacity
                  key={entry.contractId}
                  style={[styles.entryCard, { borderLeftColor: color }]}
                  onPress={() => router.push(`/contract/${entry.contractId}`)}
                >
                  <View style={styles.entryTop}>
                    <View style={styles.entryTimeRow}>
                      <Feather name="clock" size={13} color={color} />
                      <Text style={styles.entryTime}>{formatTime(entry.startDateTime)} – {formatTime(entry.endDateTime)}</Text>
                    </View>
                    <View style={[styles.entryBadge, { backgroundColor: `${color}20` }]}>
                      <Text style={[styles.entryBadgeText, { color }]}>HĐ #{entry.contractId}</Text>
                    </View>
                  </View>
                  <View style={styles.entryTenant}>
                    <View style={[styles.entryAvatar, { backgroundColor: color }]}>
                      <Text style={styles.entryAvatarText}>{getInitials(entry.tenantName)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTenantName}>{entry.tenantName}</Text>
                      {entry.businessDescription ? (
                        <Text style={styles.entryTenantDesc} numberOfLines={1}>{entry.businessDescription}</Text>
                      ) : null}
                    </View>
                    <Feather name="chevron-right" size={16} color="#D1D5DB" />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={isSpacePickerOpen} transparent animationType="fade" onRequestClose={() => setIsSpacePickerOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsSpacePickerOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chọn mặt bằng</Text>
            <FlatList
              data={ownedSpaces}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setSelectedSpaceId(String(item.id));
                    setIsSpacePickerOpen(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, String(item.id) === selectedSpaceId && { color: '#00A67E', fontWeight: 'bold' }]}>
                    {item.address}
                  </Text>
                  {String(item.id) === selectedSpaceId && <Feather name="check" size={16} color="#00A67E" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
  spaceSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB'
  },
  spaceSelectorText: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '600' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthNavBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  monthTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  weekdaysRow: { flexDirection: 'row', marginBottom: 8 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#9CA3AF' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 4, marginBottom: 20 },
  dayCell: {
    width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, padding: 2
  },
  dayCellSelected: { backgroundColor: '#00A67E' },
  dayCellToday: { backgroundColor: '#ECFDF5' },
  dayNum: { fontSize: 13, color: '#111827', fontWeight: '600' },
  dayNumOther: { color: '#D1D5DB' },
  dayNumSelected: { color: '#fff' },
  dayDots: { flexDirection: 'row', gap: 2, marginTop: 3, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dayMore: { fontSize: 8, color: '#6B7280', marginLeft: 2 },
  detailPanel: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  detailDate: { fontSize: 15, fontWeight: 'bold', color: '#111827', marginBottom: 16, textTransform: 'capitalize' },
  emptyDetail: { alignItems: 'center', justifyContent: 'center', padding: 30, gap: 10 },
  emptyDetailText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  entryCard: { borderLeftWidth: 3, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 10 },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  entryTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryTime: { fontSize: 13, fontWeight: '600', color: '#374151' },
  entryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  entryBadgeText: { fontSize: 10, fontWeight: 'bold' },
  entryTenant: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  entryAvatarText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  entryTenantName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  entryTenantDesc: { fontSize: 11, color: '#6B7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 30 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '60%' },
  modalTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'
  },
  modalOptionText: { fontSize: 14, color: '#374151', flex: 1 },
});
