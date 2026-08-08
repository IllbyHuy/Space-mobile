import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Modal, FlatList, Image, Platform
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
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

/**
 * DateField
 * ---------
 * Gộp lại 1 component riêng để xử lý 3 nền tảng, thay cho việc lặp code
 * Platform.OS === 'web' / 'ios' / 'android' ngay trong JSX như bản cũ.
 *
 * Lý do sửa (bản mới):
 * - Web: input được tách thành component riêng (WebDateInput) để React không
 *   tạo lại "instance" input mỗi lần cha re-render — đây là nguyên nhân phổ
 *   biến khiến input date trên RN-Web bị "đứng hình", không gõ/sửa được.
 * - iOS: BỎ HẲN display="compact". Trong Expo Go, "compact" tự bung 1 popover
 *   hệ thống nhưng bị vỡ layout (đè cả app, có lớp phủ xám, khung trắng
 *   trống, nút "Xong" trôi nổi sai vị trí — đúng như ảnh chụp màn hình lỗi).
 *   Thay bằng Modal tự custom (bottom sheet) + display="spinner" bên trong,
 *   có nút "Hủy"/"Xong" tự vẽ. Mình toàn quyền kiểm soát layout & chiều cao
 *   -> không còn phụ thuộc vào cách Expo Go render popover hệ thống.
 * - Android: giữ nguyên display="default" (dialog hệ thống) vì đang chạy ổn.
 */
function WebDateInput({
  value,
  min,
  onChange,
}: {
  value: string;
  min?: string;
  onChange: (val: string) => void;
}) {
  // Dùng React.createElement để render thẻ <input> HTML thật trên web.
  // Style dùng object DOM style bình thường (camelCase), không phải RN style.
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

const CustomCheckbox = ({ value, onValueChange, label }: any) => (
  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }} onPress={() => onValueChange(!value)}>
    <View style={{ width: 20, height: 20, borderWidth: 1, borderColor: '#00A67E', borderRadius: 4, marginRight: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: value ? '#00A67E' : 'transparent' }}>
      {value && <Feather name="check" size={14} color="#fff" />}
    </View>
    {label && <Text style={{ color: '#374151', flex: 1 }}>{label}</Text>}
  </TouchableOpacity>
);

const TimeField = ({ label, value, onChange }: any) => {
  const [show, setShow] = useState(false);
  const dateObj = new Date();
  try {
    const [h, m] = value.split(':');
    dateObj.setHours(parseInt(h), parseInt(m), 0, 0);
  } catch(e) {}
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios');
    if (selectedDate) {
      const hh = selectedDate.getHours().toString().padStart(2, '0');
      const mm = selectedDate.getMinutes().toString().padStart(2, '0');
      onChange(hh + ':' + mm);
    }
  };
  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.input} onPress={() => setShow(true)}>
        <Text style={{ color: '#111827' }}>{value}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={dateObj}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
        />
      )}
      {Platform.OS === 'ios' && show && (
        <TouchableOpacity style={{ alignItems: 'center', padding: 8 }} onPress={() => setShow(false)}>
          <Text style={{ color: '#00A67E', fontWeight: 'bold' }}>Xong</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

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
  // State tạm để user vặn spinner (iOS) nhưng chưa commit ra ngoài cho tới
  // khi bấm "Xong". Bấm "Hủy" thì giá trị cũ của form không đổi.
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
            {/* Bấm ra ngoài để hủy, giống hành vi action sheet chuẩn */}
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

export default function CreateListingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [priorityLevels, setPriorityLevels] = useState<any[]>([]);
  const [priorityLevelId, setPriorityLevelId] = useState<number | ''>('');
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const [isLegalCommitted, setIsLegalCommitted] = useState(false);
  const [availabilities, setAvailabilities] = useState<any[]>([
    { daysOfWeek: [], specificdate: '', startTime: '08:00', endTime: '12:00', validFrom: getSafeDateOnly(), validTo: getSafeDateOnly() }
  ]);
  
  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAYS_LABEL_VI: Record<string, string> = {
    Monday: 'T2', Tuesday: 'T3', Wednesday: 'T4', Thursday: 'T5',
    Friday: 'T6', Saturday: 'T7', Sunday: 'CN'
  };

  const [allowedStartTime, setAllowedStartTime] = useState(getSafeDateOnly());
  const [allowedEndTime, setAllowedEndTime] = useState(getNextMonthDate());

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

  // Fetch user's spaces
  useEffect(() => {
    if (!token || !currentUserId) return;
    const fetchSpaces = async () => {
      try {
        const prioRes = await fetch(`${API_BASE}/api/PriorityLevel/GetAll`, { headers: { Authorization: `Bearer ${token}`, accept: '*/*' } });
        if (prioRes.ok) {
          const prioData = await prioRes.json();
          const pList = Array.isArray(prioData) ? prioData : (prioData.data || []);
          const activePrio = pList.filter((p: any) => p.isActive);
          setPriorityLevels(activePrio);
          if (activePrio.length > 0) setPriorityLevelId(activePrio[0].id);
        }
        
        const walletRes = await fetch(`${API_BASE}/api/WalletAccount/GetByUserId?userId=${currentUserId}`, { headers: { Authorization: `Bearer ${token}`, accept: '*/*' } });
        if (walletRes.ok) {
          const wData = await walletRes.json();
          setWalletBalance(wData.balance || 0);
        }

        const res = await fetch(
          `${API_BASE}/api/Space/GetAll?OwnerId=${encodeURIComponent(currentUserId)}`,
          { headers: { Authorization: `Bearer ${token}`, accept: '*/*' } }
        );
        if (res.ok) {
          const data = await res.json();
          setMySpaces(Array.isArray(data) ? data : data?.data || []);
        }
      } catch (err) {
        console.error('Lỗi lấy dữ liệu:', err);
      }
    };
    fetchSpaces();
  }, [token, currentUserId]);

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

    if (priorityLevelId === '') {
      return Alert.alert('Lỗi', 'Vui lòng chọn gói bài đăng!');
    }
    const chosenPackagePrice = priorityLevels.find(p => p.id === priorityLevelId)?.price ?? 0;
    if (walletBalance !== null && walletBalance < chosenPackagePrice) {
      return Alert.alert('Lỗi', `Số dư ví không đủ để đăng tin! Cần ${chosenPackagePrice.toLocaleString('vi-VN')} VNĐ.`);
    }

    if (listingType === 1) {
      if (!maxRenters || parseInt(maxRenters) <= 0) {
        return Alert.alert('Lỗi', 'Số lượng người tối đa phải lớn hơn 0!');
      }
      if (availabilities.some(slot => slot.daysOfWeek.length === 0 && !slot.specificdate)) {
        return Alert.alert('Lỗi', 'Vui lòng chọn ít nhất 1 ngày hoặc ngày cụ thể cho mỗi khung giờ chia sẻ!');
      }
      const allowedEnd = new Date(allowedEndTime);
      const allowedStart = new Date(allowedStartTime);
      const badSlot = availabilities.find(slot => {
        const vFrom = new Date(slot.validFrom);
        const vTo = new Date(slot.validTo);
        return vTo > allowedEnd || vFrom < allowedStart || vFrom > vTo;
      });
      if (badSlot) {
        return Alert.alert('Lỗi', `Khung giờ áp dụng từ ${badSlot.validFrom} đến ${badSlot.validTo} không hợp lệ!`);
      }
      const badTimeSlot = availabilities.find(slot => slot.startTime >= slot.endTime);
      if (badTimeSlot) {
        return Alert.alert('Lỗi', 'Giờ kết thúc khung giờ chia sẻ phải sau giờ bắt đầu!');
      }
      if (!isLegalCommitted) {
        return Alert.alert('Lỗi', 'Vui lòng tích "Cam kết pháp lý"!');
      }
    }

    setIsSubmitting(true);

    let apiUrl = `${API_BASE}/api/Listing/Create?amount=${chosenPackagePrice}`;
    let payload: any = {
      spaceId: Number(spaceId),
      allowedStartTime: allowedStartTime.substring(0, 10),
      allowedEndTime: allowedEndTime.substring(0, 10),
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      listingPictures: [],
    };

    if (listingType === 1) {
      apiUrl = `${API_BASE}/api/Listing/CreateShareListing?amount=${chosenPackagePrice}`;
      payload = {
        ...payload,
        shareSpaceDetailMaxSubRenter: Number(maxRenters),
        shareSpaceDetailIsOwner: false,
        shareSpaceDetailIsLegalCommitted: isLegalCommitted,
        shareSpaceDetailShareSpaceAmenities: [],
        shareSpaceDetailAvailabilitiesTimes: availabilities.map(slot => ({
          ...slot,
          specificdate: slot.specificdate || null
        })),
        shareSpaceDetailShareSpaceCategories: []
      };
    }

    try {
      const res = await fetch(apiUrl, {
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
        console.error('Listing/Create error:', res.status, errBody);
        let errMsg = 'Tạo bài đăng thất bại!';
        try {
          const parsed = JSON.parse(errBody);
          errMsg = parsed.message || parsed.title || parsed.detail || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const resText = await res.text();
      let createdListingId;
      try {
        const resData = JSON.parse(resText);
        createdListingId = resData.id || resData.data?.id || resData;
      } catch {
        createdListingId = resText;
      }

      if (selectedImages.length > 0 && createdListingId) {
        const formData = new FormData();
        for (let i = 0; i < selectedImages.length; i++) {
          const img = selectedImages[i];
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
          Alert.alert('Cảnh báo', 'Tạo bài đăng thành công nhưng tải ảnh lên thất bại!');
          return router.back();
        }
      }

      Alert.alert('Thành công', 'Đã tạo bài đăng thành công!', [
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
        <Text style={styles.headerTitle}>Tạo bài đăng cho thuê</Text>
        <View style={{ width: 40 }} />
      </View>

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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Loại bài đăng *</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.typeBtn, listingType === 0 && styles.typeBtnActive]} onPress={() => setListingType(0)}>
              <Text style={[styles.typeBtnText, listingType === 0 && styles.typeBtnTextActive]}>Thuê dài hạn</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, listingType === 1 && styles.typeBtnActive]} onPress={() => setListingType(1)}>
              <Text style={[styles.typeBtnText, listingType === 1 && styles.typeBtnTextActive]}>Chia sẻ chỗ</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Gói bài đăng */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gói bài đăng *</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowPriorityPicker(true)}>
            <Text style={priorityLevelId !== '' ? styles.pickerText : styles.pickerPlaceholder}>
              {priorityLevelId !== '' ? (priorityLevels.find(p => p.id === priorityLevelId)?.name + ' - ' + priorityLevels.find(p => p.id === priorityLevelId)?.price.toLocaleString('vi-VN') + ' VNĐ') : '-- Chọn gói bài đăng --'}
            </Text>
            <Feather name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Số dư ví */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Số dư ví</Text>
          <View style={[styles.input, { backgroundColor: '#E5E7EB', justifyContent: 'center' }]}>
            <Text style={{ color: '#059669', fontWeight: 'bold' }}>
              {walletBalance !== null ? walletBalance.toLocaleString('vi-VN') + ' VNĐ' : 'Đang tải...'}
            </Text>
          </View>
        </View>

        {listingType === 1 && (
          <View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Số người thuê chung tối đa *</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={maxRenters} onChangeText={setMaxRenters} placeholder="VD: 5" />
            </View>

            <CustomCheckbox label="Cam kết pháp lý *" value={isLegalCommitted} onValueChange={setIsLegalCommitted} />

            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Khung giờ chia sẻ</Text>
            {availabilities.map((slot, index) => (
              <View key={index} style={{ backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontWeight: 'bold', color: '#374151' }}>Khung giờ {index + 1}</Text>
                  {availabilities.length > 1 && (
                    <TouchableOpacity onPress={() => setAvailabilities(prev => prev.filter((_, i) => i !== index))}>
                      <Feather name="trash-2" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {DAYS_OF_WEEK.map(day => {
                    const isSelected = slot.daysOfWeek.includes(day);
                    return (
                      <TouchableOpacity
                        key={day}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: isSelected ? '#00A67E' : '#D1D5DB', backgroundColor: isSelected ? '#00A67E' : '#fff' }}
                        onPress={() => {
                          setAvailabilities(prev => prev.map((s, i) => {
                            if (i !== index) return s;
                            const newDays = isSelected ? s.daysOfWeek.filter((d: string) => d !== day) : [...s.daysOfWeek, day];
                            return { ...s, daysOfWeek: newDays };
                          }));
                        }}
                      >
                        <Text style={{ color: isSelected ? '#fff' : '#374151', fontSize: 12 }}>{DAYS_LABEL_VI[day]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <TimeField label="Giờ bắt đầu" value={slot.startTime} onChange={(v: string) => setAvailabilities(prev => prev.map((s, i) => i === index ? { ...s, startTime: v } : s))} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TimeField label="Giờ kết thúc" value={slot.endTime} onChange={(v: string) => setAvailabilities(prev => prev.map((s, i) => i === index ? { ...s, endTime: v } : s))} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <DateField label="Áp dụng từ" value={slot.validFrom} onChange={(v: string) => setAvailabilities(prev => prev.map((s, i) => i === index ? { ...s, validFrom: v } : s))} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <DateField label="Áp dụng đến" value={slot.validTo} minDate={slot.validFrom} onChange={(v: string) => setAvailabilities(prev => prev.map((s, i) => i === index ? { ...s, validTo: v } : s))} />
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', borderStyle: 'dashed', marginBottom: 16 }}
              onPress={() => setAvailabilities(prev => [...prev, { daysOfWeek: [], specificdate: '', startTime: '08:00', endTime: '12:00', validFrom: getSafeDateOnly(), validTo: getSafeDateOnly() }])}
            >
              <Feather name="plus" size={18} color="#6B7280" style={{ marginRight: 8 }} />
              <Text style={{ color: '#6B7280', fontWeight: '500' }}>Thêm khung giờ khác</Text>
            </TouchableOpacity>
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
            <Text style={styles.submitBtnText}>Đăng bài cho thuê</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Priority Picker Modal */}
      <Modal visible={showPriorityPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn gói bài đăng</Text>
              <TouchableOpacity onPress={() => setShowPriorityPicker(false)}>
                <Feather name="x" size={22} color="#111827" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={priorityLevels}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setPriorityLevelId(item.id);
                    setShowPriorityPicker(false);
                  }}
                >
                  <Text style={styles.modalItemTitle}>{item.name}</Text>
                  <Text style={styles.modalItemSub}>{item.price.toLocaleString('vi-VN')} VNĐ</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#6B7280' }}>Không có gói nào khả dụng</Text>
                </View>
              }
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>

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

  // Bottom sheet cho date picker trên iOS (thay cho "compact" bị vỡ layout)
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  dateModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  dateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dateModalTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  dateModalCancel: { fontSize: 15, color: '#6B7280' },
  dateModalDone: { fontSize: 15, color: '#00A67E', fontWeight: '700' },
  iosSpinnerPicker: {
    height: 216,
    width: '100%',
    backgroundColor: '#fff',
    alignSelf: 'center',
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
});