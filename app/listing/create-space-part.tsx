import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Switch, Modal, FlatList
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

const AMENITIES_IDS = ['wifi', 'ac', 'parking', 'wc', 'projector', 'sound'];
const AMENITY_LABELS: Record<string, string> = {
  wifi: 'Wifi', ac: 'Máy lạnh', parking: 'Bãi đỗ xe',
  wc: 'Nhà vệ sinh', projector: 'Máy chiếu', sound: 'Âm thanh',
};

const DAYS_OF_WEEK = [
  { id: 2, label: 'Thứ 2' },
  { id: 3, label: 'Thứ 3' },
  { id: 4, label: 'Thứ 4' },
  { id: 5, label: 'Thứ 5' },
  { id: 6, label: 'Thứ 6' },
  { id: 7, label: 'Thứ 7' },
  { id: 0, label: 'CN' },
];

export default function CreateSpacePartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parentSpaceId } = useLocalSearchParams();

  const [token, setToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parentSpace, setParentSpace] = useState<any>(null);
  const [existingPartsTotalArea, setExistingPartsTotalArea] = useState(0);

  // Basic info
  const [name, setName] = useState('');
  const [area, setArea] = useState('');

  // Amenities
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  // Business categories
  const [apiCategories, setApiCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');

  // Operating hours
  const [operatingHours, setOperatingHours] = useState(
    DAYS_OF_WEEK.map(day => ({
      dayOfWeek: day.id,
      enabled: day.id !== 0,
      openTime: '08:00',
      closeTime: '22:00',
    }))
  );

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    const loadAuth = async () => {
      const tk = await AsyncStorage.getItem('portal_token');
      setToken(tk);
    };
    loadAuth();
  }, []);

  // Fetch Parent Space Details to get area, latitude, longitude
  useEffect(() => {
    if (!parentSpaceId || !token) return;
    const fetchParentSpace = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/Space/GetById${parentSpaceId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setParentSpace(data);
        }
      } catch (err) {
        console.error('Lỗi lấy thông tin space gốc:', err);
      }
    };
    fetchParentSpace();
  }, [parentSpaceId, token]);

  // Fetch existing space parts to calculate area limit
  useEffect(() => {
    if (!parentSpaceId || !token) return;
    const fetchExistingParts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/SpacePart/GetByParent/${parentSpaceId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const parts = Array.isArray(data) ? data : (data?.items || []);
          const totalArea = parts.reduce((sum: number, p: any) => sum + (p.isActive ? p.area : 0), 0);
          setExistingPartsTotalArea(totalArea);
        }
      } catch (err) {
        console.error('Lỗi lấy thông tin space parts hiện tại:', err);
      }
    };
    fetchExistingParts();
  }, [parentSpaceId, token]);

  // Fetch business categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/BussinessCategory/GetAll`);
        if (res.ok) {
          const data = await res.json();
          setApiCategories(Array.isArray(data) ? data : data?.items || []);
        }
      } catch (err) {
        console.error('Lỗi lấy danh sách ngành nghề:', err);
      }
    };
    fetchCategories();
  }, []);

  const toggleAmenity = (id: string) => {
    setSelectedAmenities(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const toggleDay = (dayOfWeek: number) => {
    setOperatingHours(prev =>
      prev.map(item =>
        item.dayOfWeek === dayOfWeek ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const handleSubmit = async () => {
    if (!name.trim() || !area.trim()) {
      return Alert.alert('Lỗi', 'Vui lòng điền đủ tên và diện tích!');
    }

    if (!parentSpace) {
      return Alert.alert('Lỗi', 'Chưa tải được thông tin mặt bằng gốc!');
    }

    const numArea = Number(area);
    const parentArea = Number(parentSpace.area) || 0;
    const availableArea = parentArea - existingPartsTotalArea;

    if (numArea > availableArea) {
      return Alert.alert('Lỗi', `Diện tích không gian con (${numArea}m²) vượt quá diện tích còn lại của không gian gốc (${availableArea}m²).`);
    }

    setIsSubmitting(true);

    const payload = {
      name: name.trim(),
      area: numArea,
      isActive: true,
      latitude: parentSpace.latitude || 0,
      longitude: parentSpace.longitude || 0,
      amenities: selectedAmenities.map(am => ({
        name: am,
        quantity: 1,
        isActive: true,
      })),
      operatingHours: operatingHours
        .filter(h => h.enabled)
        .map(h => ({
          dayOfWeek: h.dayOfWeek === 0 ? 0 : h.dayOfWeek - 1,
          openTime: h.openTime.length === 5 ? `${h.openTime}:00` : h.openTime,
          closeTime: h.closeTime.length === 5 ? `${h.closeTime}:00` : h.closeTime,
        })),
      spaceAllowedCategories:
        selectedCategoryId !== ''
          ? [{ bussinessCategoryId: selectedCategoryId }]
          : [],
    };

    try {
      const res = await fetch(`${API_BASE}/api/SpacePart/Create/${parentSpaceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          accept: '*/*',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let errorMessage = errData.message || 'Không thể tạo không gian nhỏ. Kiểm tra lại thông tin!';
        if (errorMessage.includes('cannot exceed parent space area')) {
          errorMessage = 'Tổng diện tích các không gian chia nhỏ vượt quá diện tích không gian gốc.';
        }
        throw new Error(errorMessage);
      }

      Alert.alert('Thành công', 'Đã tạo không gian nhỏ thành công!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo không gian chia nhỏ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tên không gian nhỏ *</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: Góc làm việc nhóm"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Diện tích (m²) *</Text>
          <TextInput
            style={styles.input}
            placeholder={`VD: Tối đa ${Math.max(0, (parentSpace?.area || 0) - existingPartsTotalArea)}`}
            keyboardType="numeric"
            value={area}
            onChangeText={val => setArea(val.replace(/[^\d]/g, ''))}
          />
        </View>

        <Text style={styles.sectionTitle}>Tiện ích (Tuỳ chọn)</Text>
        <View style={styles.amenitiesGrid}>
          {AMENITIES_IDS.map(id => {
            const isChecked = selectedAmenities.includes(id);
            return (
              <TouchableOpacity
                key={id}
                style={[styles.amenityChip, isChecked && styles.amenityChipActive]}
                onPress={() => toggleAmenity(id)}
              >
                <Feather
                  name={isChecked ? 'check-square' : 'square'}
                  size={16}
                  color={isChecked ? '#00A67E' : '#9CA3AF'}
                />
                <Text style={[styles.amenityText, isChecked && styles.amenityTextActive]}>
                  {AMENITY_LABELS[id]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Ngành nghề cho phép (Tuỳ chọn)</Text>
        <View style={styles.inputGroup}>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setShowCategoryPicker(true)}
          >
            <Text style={selectedCategoryId !== '' ? styles.pickerText : styles.pickerPlaceholder}>
              {selectedCategoryId !== ''
                ? apiCategories.find(c => c.id === selectedCategoryId)?.name || 'Đã chọn'
                : 'Không (Không thiết lập)'}
            </Text>
            <Feather name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Giờ hoạt động (Tuỳ chọn)</Text>
        {operatingHours.map(item => {
          const dayInfo = DAYS_OF_WEEK.find(d => d.id === item.dayOfWeek);
          return (
            <View key={item.dayOfWeek} style={styles.dayRow}>
              <View style={styles.dayToggle}>
                <Switch
                  value={item.enabled}
                  onValueChange={() => toggleDay(item.dayOfWeek)}
                  trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                  thumbColor={item.enabled ? '#00A67E' : '#F3F4F6'}
                />
                <Text style={[styles.dayLabel, !item.enabled && { color: '#9CA3AF' }]}>
                  {dayInfo?.label}
                </Text>
              </View>
              {item.enabled && (
                <View style={styles.timeRow}>
                  <TextInput
                    style={styles.timeInput}
                    value={item.openTime}
                    onChangeText={val =>
                      setOperatingHours(prev =>
                        prev.map(h => h.dayOfWeek === item.dayOfWeek ? { ...h, openTime: val } : h)
                      )
                    }
                  />
                  <Text style={styles.timeSep}>—</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={item.closeTime}
                    onChangeText={val =>
                      setOperatingHours(prev =>
                        prev.map(h => h.dayOfWeek === item.dayOfWeek ? { ...h, closeTime: val } : h)
                      )
                    }
                  />
                </View>
              )}
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Lưu không gian con</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn ngành nghề</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Feather name="x" size={22} color="#111827" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: '', name: 'Không (Không thiết lập)' }, ...apiCategories]}
              keyExtractor={(item, idx) => `${item.id}-${idx}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedCategoryId(item.id === '' ? '' : Number(item.id));
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0D1117',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  scrollContent: { flex: 1 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 8 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#111827',
  },
  pickerBtn: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pickerText: { fontSize: 15, color: '#111827' },
  pickerPlaceholder: { fontSize: 15, color: '#9CA3AF' },

  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  amenityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  amenityChipActive: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  amenityText: { fontSize: 14, color: '#6B7280' },
  amenityTextActive: { color: '#065F46', fontWeight: '500' },

  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  dayToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayLabel: { fontSize: 14, fontWeight: '600', color: '#334155', width: 50 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeInput: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 14, color: '#111827', width: 65, textAlign: 'center',
  },
  timeSep: { color: '#94A3B8', fontSize: 16 },

  submitBtn: {
    backgroundColor: '#00A67E', paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', marginTop: 24,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 30, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#111827' },
  modalItem: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  modalItemText: { fontSize: 15, color: '#374151' },
});
