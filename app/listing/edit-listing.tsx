import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Modal, FlatList, Image, Platform
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

const getSafeDateOnly = () => {
  return new Date().toISOString().slice(0, 10);
};

const getNextMonthDate = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

function WebDateInput({
  value,
  min,
  onChange,
}: {
  value: string;
  min?: string;
  onChange: (val: string) => void;
}) {
  return React.createElement('input', {
    type: 'date',
    value: value || '',
    min: min || undefined,
    onChange: (e: any) => onChange(e.target.value),
    style: {
      padding: '10px 12px',
      borderRadius: 8,
      border: '1px solid #D1D5DB',
      width: '100%',
      fontSize: 15,
      boxSizing: 'border-box',
      backgroundColor: '#fff',
      color: '#111827',
      cursor: 'pointer',
      pointerEvents: 'auto',
      position: 'relative',
      zIndex: 1,
      colorScheme: 'light',
    },
  });
}

function DateField({
  label,
  value,
  minDate,
  onChange,
}: {
  label: string;
  value: string;
  minDate?: string;
  onChange: (val: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date(value || Date.now()));

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.inputGroup, { flex: 1 }]}>
        <Text style={styles.label}>{label}</Text>
        <WebDateInput value={value} min={minDate} onChange={onChange} />
      </View>
    );
  }

  return (
    <View style={[styles.inputGroup, { flex: 1 }]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.input, { justifyContent: 'center' }]}
        onPress={() => {
          setTempDate(new Date(value || Date.now()));
          setShowPicker(true);
        }}
      >
        <Text style={{ color: value ? '#111827' : '#9CA3AF' }}>
          {value || 'Chọn ngày'}
        </Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' ? (
        <Modal visible={showPicker} transparent animationType="slide">
          <View style={styles.dateModalOverlay}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowPicker(false)}
            />
            <View style={styles.dateModalContent}>
              <View style={styles.dateModalHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.dateModalCancel}>Hủy</Text>
                </TouchableOpacity>
                <Text style={styles.dateModalTitle}>{label}</Text>
                <TouchableOpacity
                  onPress={() => {
                    onChange(tempDate.toISOString().slice(0, 10));
                    setShowPicker(false);
                  }}
                >
                  <Text style={styles.dateModalDone}>Xong</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                themeVariant="light"
                minimumDate={minDate ? new Date(minDate) : undefined}
                onChange={(event, selectedDate) => {
                  if (selectedDate) setTempDate(selectedDate);
                }}
                style={styles.iosSpinnerPicker}
              />
            </View>
          </View>
        </Modal>
      ) : (
        showPicker && (
          <DateTimePicker
            value={new Date(value || Date.now())}
            mode="date"
            display="default"
            themeVariant="light"
            minimumDate={minDate ? new Date(minDate) : undefined}
            onChange={(event, selectedDate) => {
              setShowPicker(false);
              if (selectedDate) {
                onChange(selectedDate.toISOString().slice(0, 10));
              }
            }}
          />
        )
      )}
    </View>
  );
}

export default function EditListingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();

  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [mySpaces, setMySpaces] = useState<any[]>([]);
  const [showSpacePicker, setShowSpacePicker] = useState(false);

  // Form data — matches web ListingForm.tsx
  const [spaceId, setSpaceId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [listingType, setListingType] = useState<0 | 1>(0);
  const [maxRenters, setMaxRenters] = useState('');
  const [availableSlots, setAvailableSlots] = useState('');
  const [allowedStartTime, setAllowedStartTime] = useState(getSafeDateOnly());
  const [allowedEndTime, setAllowedEndTime] = useState(getNextMonthDate());
  
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  useEffect(() => {
    const loadAuth = async () => {
      const tk = await AsyncStorage.getItem('portal_token');
      const uid = await AsyncStorage.getItem('current_user_id');
      setToken(tk);
      setCurrentUserId(uid);
    };
    loadAuth();
  }, []);

  // Fetch user's spaces and listing data
  useEffect(() => {
    const fetchData = async () => {
      if (!token || !currentUserId || !id) return;
      try {
        setIsLoadingData(true);
        // Load spaces
        const spaceRes = await fetch(`${API_BASE}/api/Space/GetAll`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (spaceRes.ok) {
          const data = await spaceRes.json();
          const allSpaces = Array.isArray(data) ? data : (data?.data || data?.items || []);
          const mine = allSpaces.filter((s: any) => 
            String(s.ownerId || s.creatorId || s.createdBy) === String(currentUserId)
          );
          setMySpaces(mine);
        }

        // Load listing detail
        const listingRes = await fetch(`${API_BASE}/api/Listing/GetAll`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (listingRes.ok) {
          const listData = await listingRes.json();
          const allListings = Array.isArray(listData) ? listData : (listData?.data || listData?.items || []);
          const target = allListings.find((l: any) => String(l.id || l.Id) === String(id));
          if (target) {
            setSpaceId(target.spaceId || target.SpaceId || '');
            setName(target.name || target.title || '');
            setDescription(target.description || '');
            setPrice(target.price?.toString() || '');
            const type = target.listingType === 'SharedSpace' || target.listingType === 1 ? 1 : 0;
            setListingType(type);
            if (type === 1) {
              setMaxRenters(target.maxRenters?.toString() || '');
              setAvailableSlots(target.availableSlots?.toString() || '');
            }
            if (target.allowedStartTime) setAllowedStartTime(target.allowedStartTime.substring(0, 10));
            if (target.allowedEndTime) setAllowedEndTime(target.allowedEndTime.substring(0, 10));
          }
        }
      } catch (error) {
        console.error("Lỗi tải dữ liệu edit:", error);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [token, currentUserId, id]);

  const selectedSpace = mySpaces.find(s => (s.id || s.Id) === spaceId);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImages((prev) => [...prev, ...result.assets]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (spaceId === '') {
      return Alert.alert('Lỗi', 'Vui lòng chọn mặt bằng!');
    }
    if (!name.trim()) {
      return Alert.alert('Lỗi', 'Vui lòng nhập tên bài đăng!');
    }
    if (!description.trim()) {
      return Alert.alert('Lỗi', 'Vui lòng nhập mô tả!');
    }
    if (!price || Number(price) <= 0) {
      return Alert.alert('Lỗi', 'Đơn giá phải lớn hơn 0!');
    }

    const startDate = new Date(allowedStartTime);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      return Alert.alert('Lỗi', 'Thời gian bắt đầu không thể nằm trong quá khứ!');
    }

    if (new Date(allowedEndTime) <= new Date(allowedStartTime)) {
      return Alert.alert('Lỗi', 'Thời gian kết thúc phải sau thời gian bắt đầu!');
    }

    if (listingType === 1) {
      if (!maxRenters || parseInt(maxRenters) <= 0) {
        return Alert.alert('Lỗi', 'Số lượng người tối đa phải lớn hơn 0!');
      }
      if (!availableSlots || parseInt(availableSlots) <= 0) {
        return Alert.alert('Lỗi', 'Số lượng chỗ trống phải lớn hơn 0!');
      }
      if (parseInt(availableSlots) > parseInt(maxRenters)) {
        return Alert.alert('Lỗi', 'Số lượng chỗ trống không được lớn hơn số lượng người tối đa!');
      }
    }

    setIsSubmitting(true);

    const payload = {
      spaceId: Number(spaceId),
      allowedStartTime: allowedStartTime.substring(0, 10),
      allowedEndTime: allowedEndTime.substring(0, 10),
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      listingType: listingType,
      maxRenters: listingType === 1 ? parseInt(maxRenters) : null,
      availableSlots: listingType === 1 ? parseInt(availableSlots) : null,
      listingPictures: [],
    };

    try {
      const res = await fetch(`${API_BASE}/api/Listing/Update/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          accept: '*/*',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.error('Listing/Update error:', res.status, errBody);
        let errMsg = 'Cập nhật bài đăng thất bại!';
        try {
          const parsed = JSON.parse(errBody);
          errMsg = parsed.message || parsed.title || parsed.detail || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const createdListingId = id;

      if (selectedImages.length > 0 && createdListingId) {
        const formData = new FormData();
        for (let i = 0; i < selectedImages.length; i++) {
          const img = selectedImages[i];
          if ((img as any).id) continue;
          if (Platform.OS === 'web') {
            const fetchRes = await fetch(img.uri);
            const blob = await fetchRes.blob();
            formData.append('file', blob, img.fileName || `image_${i}.jpg`);
          } else {
            const filename = img.fileName || img.uri.split('/').pop() || `image_${i}.jpg`;
            const type = img.mimeType || 'image/jpeg';
            formData.append('file', {
              uri: img.uri,
              name: filename,
              type,
            } as any);
          }
        }
        formData.append('listingId', createdListingId.toString());

        const picRes = await fetch(`${API_BASE}/api/Picture`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            accept: '*/*',
          },
          body: formData,
        });

        if (!picRes.ok) {
          console.error('Lỗi up ảnh:', await picRes.text().catch(() => ''));
          Alert.alert('Cảnh báo', 'Cập nhật thành công nhưng tải ảnh lên thất bại!');
          return router.back();
        }
      }

      Alert.alert('Thành công', 'Đã cập nhật bài đăng thành công!', [
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
        <Text style={styles.headerTitle}>Sửa bài đăng</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoadingData ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00A67E" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Chọn mặt bằng */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mặt bằng *</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setShowSpacePicker(true)}
            >
              <Text style={selectedSpace ? styles.pickerText : styles.pickerPlaceholder}>
                {selectedSpace ? selectedSpace.name : '-- Chọn mặt bằng --'}
              </Text>
              <Feather name="chevron-down" size={18} color="#6B7280" />
            </TouchableOpacity>
            {mySpaces.length === 0 && (
              <Text style={styles.hintText}>
                Bạn chưa có mặt bằng nào. Hãy tạo mặt bằng trước!
              </Text>
            )}
          </View>

          {/* Loại bài đăng */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Loại bài đăng *</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity 
                style={[styles.typeBtn, listingType === 0 && styles.typeBtnActive]}
                onPress={() => setListingType(0)}>
                <Text style={[styles.typeBtnText, listingType === 0 && styles.typeBtnTextActive]}>Thuê dài hạn</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeBtn, listingType === 1 && styles.typeBtnActive]}
                onPress={() => setListingType(1)}>
                <Text style={[styles.typeBtnText, listingType === 1 && styles.typeBtnTextActive]}>Chia sẻ chỗ</Text>
              </TouchableOpacity>
            </View>
          </View>

          {listingType === 1 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Số người tối đa *</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={maxRenters} onChangeText={setMaxRenters} placeholder="VD: 5" />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Chỗ trống *</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={availableSlots} onChangeText={setAvailableSlots} placeholder="VD: 2" />
              </View>
            </View>
          )}

          {/* Tên bài đăng */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tên bài đăng *</Text>
            <TextInput
              style={styles.input}
              placeholder="VD: Cho thuê văn phòng tầng 3"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Mô tả */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mô tả *</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Mô tả chi tiết về mặt bằng cho thuê..."
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          {/* Giá */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Đơn giá (VND/tháng) *</Text>
            <TextInput
              style={styles.input}
              placeholder="VD: 5000000"
              keyboardType="numeric"
              value={price}
              onChangeText={val => setPrice(val.replace(/[^\d]/g, ''))}
            />
            {price ? (
              <Text style={styles.hintText}>
                = {Number(price).toLocaleString('vi-VN')} VNĐ
              </Text>
            ) : null}
          </View>

          {/* Thời gian hiệu lực */}
          <Text style={styles.sectionTitle}>Thời gian hiệu lực</Text>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <DateField
                label="Từ ngày"
                value={allowedStartTime}
                onChange={setAllowedStartTime}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <DateField
                label="Đến ngày"
                value={allowedEndTime}
                minDate={allowedStartTime}
                onChange={setAllowedEndTime}
              />
            </View>
          </View>

          {/* Hình ảnh */}
          <Text style={styles.sectionTitle}>Hình ảnh bài đăng (Tùy chọn)</Text>
          <TouchableOpacity style={styles.pickImageBtn} onPress={pickImage}>
            <Feather name="image" size={20} color="#00A67E" />
            <Text style={styles.pickImageText}>Chọn ảnh từ thư viện</Text>
          </TouchableOpacity>
          
          {selectedImages.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewContainer}>
              {selectedImages.map((img, idx) => (
                <View key={idx} style={styles.imagePreviewWrapper}>
                  <Image source={{ uri: img.uri }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(idx)}>
                    <Feather name="x" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Cập nhật bài đăng</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Space Picker Modal */}
      <Modal visible={showSpacePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn mặt bằng</Text>
              <TouchableOpacity onPress={() => setShowSpacePicker(false)}>
                <Feather name="x" size={22} color="#111827" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={mySpaces}
              keyExtractor={(item) => String(item.id || item.Id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSpaceId(item.id || item.Id);
                    setShowSpacePicker(false);
                  }}
                >
                  <Text style={styles.modalItemTitle}>{item.name}</Text>
                  <Text style={styles.modalItemSub}>
                    {item.address || 'Chưa có địa chỉ'} • {item.area ? `${item.area} m²` : ''}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#6B7280' }}>Chưa có mặt bằng nào</Text>
                </View>
              }
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

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#111827',
    marginTop: 16, marginBottom: 8,
  },

  inputGroup: { marginBottom: 14 },
  row: { flexDirection: 'row' },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#111827',
  },
  hintText: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F9FAFB'
  },
  typeBtnActive: {
    borderColor: '#00A67E',
    backgroundColor: '#00A67E20'
  },
  typeBtnText: {
    color: '#374151',
    fontWeight: '500'
  },
  typeBtnTextActive: {
    color: '#00A67E',
    fontWeight: 'bold'
  },

  pickImageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
    borderStyle: 'dashed', borderRadius: 8, padding: 16, marginBottom: 12, gap: 8
  },
  pickImageText: { color: '#00A67E', fontWeight: '500' },
  imagePreviewContainer: { flexDirection: 'row', marginBottom: 16 },
  imagePreviewWrapper: { marginRight: 12, position: 'relative' },
  imagePreview: { width: 80, height: 80, borderRadius: 8 },
  removeImageBtn: {
    position: 'absolute', top: -6, right: -6, backgroundColor: 'red',
    borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff'
  },

  pickerBtn: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pickerText: { fontSize: 15, color: '#111827', flex: 1 },
  pickerPlaceholder: { fontSize: 15, color: '#9CA3AF', flex: 1 },

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
  modalItemTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  modalItemSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  dateModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  dateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  dateModalCancel: { color: '#6B7280', fontSize: 16 },
  dateModalDone: { color: '#00A67E', fontSize: 16, fontWeight: 'bold' },
  dateModalTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  iosSpinnerPicker: { height: 200 },
});
