import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Switch, Modal, FlatList
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
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

export default function CreateSpaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [token, setToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Basic info
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');

  // Address cascade: Province -> District -> Ward
  const [provinces, setProvinces] = useState<{ value: string; label: string }[]>([]);
  const [districts, setDistricts] = useState<{ value: string; label: string }[]>([]);
  const [wards, setWards] = useState<{ value: string; label: string }[]>([]);

  const [provinceCode, setProvinceCode] = useState('');
  const [districtCode, setDistrictCode] = useState('');
  const [wardCode, setWardCode] = useState('');

  const [provinceLabel, setProvinceLabel] = useState('');
  const [districtLabel, setDistrictLabel] = useState('');
  const [wardLabel, setWardLabel] = useState('');

  // Amenities
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  // Business categories
  const [apiCategories, setApiCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');

  // Operating hours
  const [operatingHours, setOperatingHours] = useState(
    DAYS_OF_WEEK.map(day => ({
      dayOfWeek: day.id,
      enabled: day.id !== 0, // Chủ nhật mặc định tắt
      openTime: '08:00',
      closeTime: '22:00',
    }))
  );

  // Picker modals
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [showWardPicker, setShowWardPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    const loadAuth = async () => {
      const tk = await AsyncStorage.getItem('portal_token');
      setToken(tk);
    };
    loadAuth();
  }, []);

  // Fetch provinces on mount
  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/Space/GetAddress`, {
          headers: { accept: '*/*' },
        });
        if (res.ok) {
          const data = await res.json();
          setProvinces(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Lỗi lấy danh sách tỉnh/thành:', err);
      }
    };
    fetchProvinces();
  }, []);

  // Fetch business categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/BussinessCategory/GetAll`, {
          headers: { accept: '*/*' },
        });
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

  const handleProvinceSelect = async (item: { value: string; label: string }) => {
    setProvinceCode(item.value);
    setProvinceLabel(item.label);
    setDistrictCode('');
    setDistrictLabel('');
    setWardCode('');
    setWardLabel('');
    setDistricts([]);
    setWards([]);
    setShowProvincePicker(false);

    try {
      const res = await fetch(
        `${API_BASE}/api/Space/GetAddress?provinceCode=${encodeURIComponent(item.value)}`,
        { headers: { accept: '*/*' } }
      );
      if (res.ok) {
        const data = await res.json();
        setDistricts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách quận/huyện:', err);
    }
  };

  const handleDistrictSelect = async (item: { value: string; label: string }) => {
    setDistrictCode(item.value);
    setDistrictLabel(item.label);
    setWardCode('');
    setWardLabel('');
    setWards([]);
    setShowDistrictPicker(false);

    try {
      const res = await fetch(
        `${API_BASE}/api/Space/GetAddress?provinceCode=${encodeURIComponent(provinceCode)}&districtCode=${encodeURIComponent(item.value)}`,
        { headers: { accept: '*/*' } }
      );
      if (res.ok) {
        const data = await res.json();
        setWards(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách phường/xã:', err);
    }
  };

  const handleWardSelect = (item: { value: string; label: string }) => {
    setWardCode(item.value);
    setWardLabel(item.label);
    setShowWardPicker(false);
  };

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

  const cleanAddress = (text: string) => {
    if (!text) return '';
    return text.replace(/(Xã|Phường|Thị trấn|Huyện|Quận|Thành phố|Tỉnh|TP\.?)\s+/gi, '').trim();
  };

  const tryGeocode = async (query: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&countrycodes=vn&email=contact@yourdomain.com`;
      const geoRes = await fetch(url, {
        headers: { 'Accept-Language': 'vi' }
      });
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (Array.isArray(geoData) && geoData.length > 0) {
          return { lat: parseFloat(geoData[0].lat), lng: parseFloat(geoData[0].lon) };
        }
      }
      return null;
    } catch (err) {
      console.error(`[Geocode] Lỗi: "${query}"`, err);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !address.trim() || !area.trim()) {
      return Alert.alert('Lỗi', 'Vui lòng điền đủ tên, địa chỉ và diện tích!');
    }

    if (!provinceCode) {
      return Alert.alert('Lỗi', 'Vui lòng chọn Tỉnh/Thành phố!');
    }

    setIsSubmitting(true);

    let lat = 0;
    let lng = 0;
    const cleanWard = cleanAddress(wardLabel);
    const cleanDistrict = cleanAddress(districtLabel);
    const cleanProvince = cleanAddress(provinceLabel);

    const queriesToTry = [
      `${address}, ${cleanWard}, ${cleanDistrict}, ${cleanProvince}`,
      `${cleanWard}, ${cleanDistrict}, ${cleanProvince}`,
      `${cleanDistrict}, ${cleanProvince}`,
      cleanProvince
    ].filter(q => q && q.trim() !== ',' && q.replace(/,/g, '').trim() !== '');

    let found = false;
    for (let i = 0; i < queriesToTry.length; i++) {
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000));
      const result = await tryGeocode(queriesToTry[i]);
      if (result) {
        lat = result.lat;
        lng = result.lng;
        found = true;
        break;
      }
    }

    if (!found) {
      console.warn("Không xác định được toạ độ chính xác cho địa chỉ này (lưu tạm 0,0).");
    }

    const city = [wardLabel, districtLabel, provinceLabel].filter(Boolean).join(', ');

    const payload = {
      name: name.trim(),
      address: address.trim(),
      city,
      area: Number(area) || 0,
      isActive: true,
      latitude: lat,
      longitude: lng,
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
      const res = await fetch(`${API_BASE}/api/Space/Create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          accept: '*/*',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.error('Space/Create error:', res.status, errBody);
        throw new Error('Không thể tạo mặt bằng. Kiểm tra lại thông tin!');
      }

      Alert.alert('Thành công', 'Đã tạo mặt bằng thành công!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generic picker modal
  const renderPickerModal = (
    visible: boolean,
    setVisible: (v: boolean) => void,
    title: string,
    items: { value: string; label: string }[],
    onSelect: (item: { value: string; label: string }) => void
  ) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Feather name="x" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={items}
            keyExtractor={(item, idx) => `${item.value}-${idx}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => onSelect(item)}
              >
                <Text style={styles.modalItemText}>{item.label}</Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 400 }}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đăng ký mặt bằng</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* === THÔNG TIN CƠ BẢN === */}
        <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tên mặt bằng *</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: Văn phòng tầng 3"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Province */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tỉnh/Thành *</Text>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setShowProvincePicker(true)}
          >
            <Text style={provinceLabel ? styles.pickerText : styles.pickerPlaceholder}>
              {provinceLabel || '-- Chọn Tỉnh/Thành --'}
            </Text>
            <Feather name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* District */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Quận/Huyện *</Text>
          <TouchableOpacity
            style={[styles.pickerBtn, !provinceCode && styles.pickerDisabled]}
            onPress={() => provinceCode && setShowDistrictPicker(true)}
            disabled={!provinceCode}
          >
            <Text style={districtLabel ? styles.pickerText : styles.pickerPlaceholder}>
              {districtLabel || '-- Chọn Quận/Huyện --'}
            </Text>
            <Feather name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Ward */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phường/Xã *</Text>
          <TouchableOpacity
            style={[styles.pickerBtn, !districtCode && styles.pickerDisabled]}
            onPress={() => districtCode && setShowWardPicker(true)}
            disabled={!districtCode}
          >
            <Text style={wardLabel ? styles.pickerText : styles.pickerPlaceholder}>
              {wardLabel || '-- Chọn Phường/Xã --'}
            </Text>
            <Feather name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Street address */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Địa chỉ (Số nhà, tên đường) *</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: 120 Lê Lợi"
            value={address}
            onChangeText={setAddress}
          />
        </View>

        {/* Area */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Diện tích (m²) *</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: 50"
            keyboardType="numeric"
            value={area}
            onChangeText={val => setArea(val.replace(/[^\d]/g, ''))}
          />
        </View>

        {/* === TIỆN ÍCH === */}
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

        {/* === NGÀNH NGHỀ === */}
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

        {/* === GIỜ HOẠT ĐỘNG === */}
        <Text style={styles.sectionTitle}>Giờ hoạt động (Tuỳ chọn)</Text>
        <Text style={styles.sectionDesc}>
          Tắt tất cả nếu chưa muốn thiết lập giờ cố định
        </Text>

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
                        prev.map(h =>
                          h.dayOfWeek === item.dayOfWeek ? { ...h, openTime: val } : h
                        )
                      )
                    }
                    placeholder="08:00"
                  />
                  <Text style={styles.timeSep}>—</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={item.closeTime}
                    onChangeText={val =>
                      setOperatingHours(prev =>
                        prev.map(h =>
                          h.dayOfWeek === item.dayOfWeek ? { ...h, closeTime: val } : h
                        )
                      )
                    }
                    placeholder="22:00"
                  />
                </View>
              )}
            </View>
          );
        })}

        {/* SUBMIT */}
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Lưu mặt bằng</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Picker Modals */}
      {renderPickerModal(showProvincePicker, setShowProvincePicker, 'Chọn Tỉnh/Thành', provinces, handleProvinceSelect)}
      {renderPickerModal(showDistrictPicker, setShowDistrictPicker, 'Chọn Quận/Huyện', districts, handleDistrictSelect)}
      {renderPickerModal(showWardPicker, setShowWardPicker, 'Chọn Phường/Xã', wards, handleWardSelect)}
      {renderPickerModal(
        showCategoryPicker,
        setShowCategoryPicker,
        'Chọn ngành nghề',
        [{ value: '', label: 'Không (Không thiết lập)' }, ...apiCategories.map((c: any) => ({ value: String(c.id), label: c.name }))],
        (item) => {
          setSelectedCategoryId(item.value === '' ? '' : Number(item.value));
          setShowCategoryPicker(false);
        }
      )}
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

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#111827',
    marginTop: 20, marginBottom: 8,
  },
  sectionDesc: { fontSize: 13, color: '#6B7280', marginBottom: 12 },

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
  pickerDisabled: { opacity: 0.5 },
  pickerText: { fontSize: 15, color: '#111827' },
  pickerPlaceholder: { fontSize: 15, color: '#9CA3AF' },

  amenitiesGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8,
  },
  amenityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  amenityChipActive: {
    backgroundColor: '#ECFDF5', borderColor: '#A7F3D0',
  },
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

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingBottom: 30, maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#111827' },
  modalItem: {
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  modalItemText: { fontSize: 15, color: '#374151' },
});
