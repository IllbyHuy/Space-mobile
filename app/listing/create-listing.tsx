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
import * as Linking from 'expo-linking';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

const getSafeDateOnly = (dateString?: any) => {
  try {
    if (!dateString) return new Date().toISOString().slice(0, 10);
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
    return date.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

const getNextMonthDate = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

const getValidDaysOfWeek = (validFrom?: string, validTo?: string) => {
  if (!validFrom || !validTo) return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  const parseDate = (dStr: string) => {
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0);
    }
    return new Date(dStr);
  };

  const start = parseDate(validFrom);
  const end = parseDate(validTo);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays >= 6) {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  }

  const validDays = [];
  const current = new Date(start.getTime());
  const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let i = 0; i <= diffDays; i++) {
    validDays.push(daysMap[current.getDay()]);
    current.setDate(current.getDate() + 1);
  }
  return [...new Set(validDays)];
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
  disabled,
  onChange,
}: {
  value: string;
  min?: string;
  disabled?: boolean;
  onChange: (val: string) => void;
}) {
  return React.createElement('input', {
    type: 'date',
    value: value || '',
    min: min || undefined,
    disabled: disabled,
    onChange: (e: any) => onChange(e.target.value),
    style: {
      padding: '10px 12px',
      borderRadius: 8,
      border: '1px solid #D1D5DB',
      width: '100%',
      fontSize: 15,
      boxSizing: 'border-box',
      backgroundColor: disabled ? '#F3F4F6' : '#fff',
      color: disabled ? '#9CA3AF' : '#111827',
      cursor: disabled ? 'not-allowed' : 'pointer',
      pointerEvents: disabled ? 'none' : 'auto',
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
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  minDate?: string;
  disabled?: boolean;
  onChange: (val: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date(value || Date.now()));

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.inputGroup, { flex: 1 }]}>
        <Text style={styles.label}>{label}</Text>
        <WebDateInput value={value} min={minDate} disabled={disabled} onChange={onChange} />
      </View>
    );
  }

  return (
    <View style={[styles.inputGroup, { flex: 1 }]}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.input, { justifyContent: 'center', backgroundColor: disabled ? '#F3F4F6' : '#fff' }]}
        disabled={disabled}
        onPress={() => {
          setTempDate(new Date(value || Date.now()));
          setShowPicker(true);
        }}
      >
        <Text style={{ color: value && !disabled ? '#111827' : '#9CA3AF' }}>
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
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [showSpacePicker, setShowSpacePicker] = useState(false);

  // Form data — matches web ListingForm.tsx
  const [spaceId, setSpaceId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState('PerHour');
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
  const [timePolicy, setTimePolicy] = useState<any>(null);

  useEffect(() => {
    if (!spaceId) {
      setTimePolicy(null);
      return;
    }
    const fetchTimePolicy = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/Listing/ShareListing/TimePolicy/${spaceId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTimePolicy(data);
          if (data && data.allowedStartTime) {
            setAllowedStartTime(getSafeDateOnly(data.allowedStartTime));
          }
          if (data && data.allowedEndTime) {
            setAllowedEndTime(getSafeDateOnly(data.allowedEndTime));
          }
        } else {
          setTimePolicy(null);
        }
      } catch (err) {
        setTimePolicy(null);
      }
    };
    if (token) fetchTimePolicy();
  }, [spaceId, token]);

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
          try {
            const text = await prioRes.text();
            const prioData = text ? JSON.parse(text) : [];
            const pList = Array.isArray(prioData) ? prioData : (prioData.data || []);
            const activePrio = pList.filter((p: any) => p.isActive);
            setPriorityLevels(activePrio);
            if (activePrio.length > 0) setPriorityLevelId(activePrio[0].id);
          } catch(e) {}
        }
        
        const walletRes = await fetch(`${API_BASE}/api/WalletAccount/GetByUserId?userId=${currentUserId}`, { headers: { Authorization: `Bearer ${token}`, accept: '*/*' } });
        if (walletRes.ok) {
          try {
            const text = await walletRes.text();
            const wData = text ? JSON.parse(text) : {};
            setWalletBalance(wData.balance || 0);
          } catch(e) {}
        }

        const res = await fetch(
          `${API_BASE}/api/Space/GetAll?OwnerId=${encodeURIComponent(currentUserId)}`,
          { headers: { Authorization: `Bearer ${token}`, accept: '*/*' } }
        );
        if (res.ok) {
          let spaces: any[] = [];
          try {
            const text = await res.text();
            const data = text ? JSON.parse(text) : [];
            spaces = Array.isArray(data) ? data : data?.data || [];
          } catch(e) {}
          
          let allSpacesAndParts: any[] = [];
          
          for (const space of spaces) {
            allSpacesAndParts.push({ ...space, isPart: false });
            try {
              const partRes = await fetch(`${API_BASE}/api/SpacePart/GetByParent/${space.id || space.Id}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'accept': '*/*' }
              });
              if (partRes.ok) {
                try {
                  const text = await partRes.text();
                  const partData = text ? JSON.parse(text) : [];
                  const parts = Array.isArray(partData) ? partData : (partData?.items || []);
                  parts.forEach((p: any) => {
                    allSpacesAndParts.push({ ...p, isPart: true, parentName: space.name });
                  });
                } catch(e) {}
              }
            } catch (err) {
              console.error("Lỗi lấy space part", err);
            }
          }
          
          try {
            const usageRes = await fetch(`${API_BASE}/api/SpaceUsageRight/Mine`, {
              headers: { 'Authorization': `Bearer ${token}`, 'accept': '*/*' }
            });
            if (usageRes.ok) {
              try {
                const text = await usageRes.text();
                const usageData = text ? JSON.parse(text) : [];
                const rights = Array.isArray(usageData) ? usageData : usageData?.data || [];
                const shareableRights = rights.filter((r: any) => r.canShare === true);
                const spacePromises = shareableRights.map((r: any) =>
                  fetch(`${API_BASE}/api/Space/GetById/${r.spaceId}`, {
                    headers: { Authorization: `Bearer ${token}`, accept: '*/*' },
                  }).then(r => r.ok ? r.text().then(t => t ? JSON.parse(t) : null).catch(() => null) : null)
                );
                const resolvedSpaces = await Promise.all(spacePromises);
                const validUsageSpaces = resolvedSpaces.filter(Boolean);
                for (const space of validUsageSpaces) {
                  if (!allSpacesAndParts.some(s => String(s.id || s.Id) === String(space.id || space.Id))) {
                    allSpacesAndParts.push({ ...space, isPart: false });
                  }
                }
              } catch(e) {}
            }
          } catch (e) {
            console.error("Lỗi lấy quyền sử dụng mặt bằng", e);
          }

          setMySpaces(allSpacesAndParts);

          const ownerIds = Array.from(new Set(allSpacesAndParts.map(s => s.ownerId || s.OwnerId || s.userId || s.UserId).filter(Boolean)));
          const ownerPromises = ownerIds.map(async (id: any) => {
              try {
                  const resp = await fetch(`${API_BASE}/api/User/${id}`, { headers: { 'Authorization': `Bearer ${token}` }});
                  if (resp.ok) {
                      const text = await resp.text();
                      const data = text ? JSON.parse(text) : {};
                      return { id, name: data.profileFullName || data.userName || data.email || 'Unknown' };
                  }
              } catch {}
              return { id, name: 'Unknown' };
          });
          const resolvedOwners = await Promise.all(ownerPromises);
          const ownerMap: Record<string, string> = {};
          resolvedOwners.forEach(o => { ownerMap[o.id] = o.name; });
          setOwnerNames(ownerMap);

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
      if (Platform.OS === 'web') return window.alert('Vui lòng chọn mặt bằng!');
      return Alert.alert('Lỗi', 'Vui lòng chọn mặt bằng!');
    }
    if (!name.trim()) {
      if (Platform.OS === 'web') return window.alert('Vui lòng nhập tên bài đăng!');
      return Alert.alert('Lỗi', 'Vui lòng nhập tên bài đăng!');
    }
    if (!description.trim()) {
      if (Platform.OS === 'web') return window.alert('Vui lòng nhập mô tả!');
      return Alert.alert('Lỗi', 'Vui lòng nhập mô tả!');
    }
    if (!price || Number(price) <= 0) {
      if (Platform.OS === 'web') return window.alert('Đơn giá phải lớn hơn 0!');
      return Alert.alert('Lỗi', 'Đơn giá phải lớn hơn 0!');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startCheck = new Date(allowedStartTime);
    startCheck.setHours(0, 0, 0, 0);

    if (listingType === 0 && startCheck < today) {
      if (Platform.OS === 'web') return window.alert('Thời gian bắt đầu không được ở quá khứ!');
      return Alert.alert('Lỗi', 'Thời gian bắt đầu không được ở quá khứ!');
    }

    if (new Date(allowedEndTime) <= new Date(allowedStartTime)) {
      if (Platform.OS === 'web') return window.alert('Thời gian kết thúc phải sau thời gian bắt đầu!');
      return Alert.alert('Lỗi', 'Thời gian kết thúc phải sau thời gian bắt đầu!');
    }

    const startD = new Date(allowedStartTime);
    const endD = new Date(allowedEndTime);
    const durationDays = Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 3600 * 24));

    if (priceUnit === 'PerWeek' && durationDays < 7) {
      if (Platform.OS === 'web') return window.alert('Để chọn đơn vị "/ Tuần", khoảng thời gian hiệu lực phải ít nhất 7 ngày.');
      return Alert.alert('Lỗi', 'Để chọn đơn vị "/ Tuần", khoảng thời gian hiệu lực phải ít nhất 7 ngày.');
    }
    if (priceUnit === 'PerMonth' && durationDays < 30) {
      if (Platform.OS === 'web') return window.alert('Để chọn đơn vị "/ Tháng", khoảng thời gian hiệu lực phải ít nhất 30 ngày.');
      return Alert.alert('Lỗi', 'Để chọn đơn vị "/ Tháng", khoảng thời gian hiệu lực phải ít nhất 30 ngày.');
    }
    if (priceUnit === 'PerYear' && durationDays < 365) {
      if (Platform.OS === 'web') return window.alert('Để chọn đơn vị "/ Năm", khoảng thời gian hiệu lực phải ít nhất 365 ngày.');
      return Alert.alert('Lỗi', 'Để chọn đơn vị "/ Năm", khoảng thời gian hiệu lực phải ít nhất 365 ngày.');
    }

    if (priorityLevelId === '') {
      if (Platform.OS === 'web') return window.alert('Vui lòng chọn gói bài đăng!');
      return Alert.alert('Lỗi', 'Vui lòng chọn gói bài đăng!');
    }
    const chosenPackagePrice = priorityLevels.find(p => p.id === priorityLevelId)?.price ?? 0;
    if (walletBalance !== null && walletBalance < chosenPackagePrice) {
      if (Platform.OS === 'web') return window.alert(`Số dư ví không đủ để đăng tin! Cần ${chosenPackagePrice.toLocaleString('vi-VN')} VNĐ.`);
      return Alert.alert('Lỗi', `Số dư ví không đủ để đăng tin! Cần ${chosenPackagePrice.toLocaleString('vi-VN')} VNĐ.`);
    }

    if (listingType === 1) {
      if (!maxRenters || parseInt(maxRenters) <= 0) {
        if (Platform.OS === 'web') return window.alert('Số lượng người tối đa phải lớn hơn 0!');
        return Alert.alert('Lỗi', 'Số lượng người tối đa phải lớn hơn 0!');
      }
      if (availabilities.some(slot => slot.daysOfWeek.length === 0 && !slot.specificdate)) {
        if (Platform.OS === 'web') return window.alert('Vui lòng chọn ít nhất 1 ngày hoặc ngày cụ thể cho mỗi khung giờ chia sẻ!');
        return Alert.alert('Lỗi', 'Vui lòng chọn ít nhất 1 ngày hoặc ngày cụ thể cho mỗi khung giờ chia sẻ!');
      }
      const allowedEnd = new Date(allowedEndTime);
      const allowedStart = new Date(allowedStartTime);
      allowedEnd.setHours(23, 59, 59, 999);
      allowedStart.setHours(0, 0, 0, 0);

      const badSlot = availabilities.find(slot => {
        if (!slot.validFrom || !slot.validTo) return false;
        const vFrom = new Date(slot.validFrom);
        const vTo = new Date(slot.validTo);
        vFrom.setHours(0, 0, 0, 0);
        vTo.setHours(23, 59, 59, 999);
        return vTo > allowedEnd || vFrom < allowedStart || vFrom > vTo;
      });
      if (badSlot) {
        if (Platform.OS === 'web') return window.alert(`Khung giờ áp dụng từ ${badSlot.validFrom} đến ${badSlot.validTo} không hợp lệ! Thời gian phải nằm trong khoảng từ ${allowedStartTime} đến ${allowedEndTime}.`);
        return Alert.alert('Lỗi', `Khung giờ áp dụng từ ${badSlot.validFrom} đến ${badSlot.validTo} không hợp lệ! Thời gian phải nằm trong khoảng từ ${allowedStartTime} đến ${allowedEndTime}.`);
      }

      const badSpecificDate = availabilities.find(slot => {
        if (!slot.specificdate || slot.specificdate === '0001-01-01') return false;
        const sDate = new Date(slot.specificdate);
        sDate.setHours(0, 0, 0, 0);
        return sDate > allowedEnd || sDate < allowedStart;
      });
      if (badSpecificDate) {
        if (Platform.OS === 'web') return window.alert(`Ngày cụ thể của khung giờ chia sẻ phải nằm trong khoảng thời gian hiệu lực bài đăng!`);
        return Alert.alert('Lỗi', `Ngày cụ thể của khung giờ chia sẻ phải nằm trong khoảng thời gian hiệu lực bài đăng!`);
      }
      const badTimeSlot = availabilities.find(slot => slot.startTime >= slot.endTime);
      if (badTimeSlot) {
        if (Platform.OS === 'web') return window.alert('Giờ kết thúc khung giờ chia sẻ phải sau giờ bắt đầu!');
        return Alert.alert('Lỗi', 'Giờ kết thúc khung giờ chia sẻ phải sau giờ bắt đầu!');
      }
      if (!isLegalCommitted) {
        if (Platform.OS === 'web') return window.alert('Vui lòng tích "Cam kết pháp lý"!');
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
      priceUnit,
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
          specificdate: (slot.specificdate && !slot.specificdate.startsWith('0001')) ? slot.specificdate : undefined
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
        let errMsg = errBody || 'Tạo bài đăng thất bại!';
        try {
          const parsed = JSON.parse(errBody);
          if (parsed.errors && typeof parsed.errors === 'object') {
            const fieldMessages = Object.values(parsed.errors).flat().filter(Boolean) as string[];
            if (fieldMessages.length > 0) {
              errMsg = fieldMessages.join('\n');
            } else {
              errMsg = parsed.message || parsed.title || parsed.detail || errMsg;
            }
          } else {
            errMsg = parsed.message || parsed.title || parsed.detail || errMsg;
          }
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
          if (Platform.OS === 'web') {
            window.alert('Tạo bài đăng thành công nhưng tải ảnh lên thất bại!');
            router.back();
            return;
          }
          Alert.alert('Cảnh báo', 'Tạo bài đăng thành công nhưng tải ảnh lên thất bại!', [{ text: 'OK', onPress: () => router.back() }]);
          return;
        }
      }

      if (Platform.OS === 'web') {
        window.alert('Đã tạo bài đăng thành công!');
        router.back();
      } else {
        Alert.alert('Thành công', 'Đã tạo bài đăng thành công!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(err.message);
      } else {
        Alert.alert('Lỗi', err.message);
      }
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
              {selectedSpace ? (
                  `${selectedSpace.isPart ? `${selectedSpace.name} (Thuộc: ${selectedSpace.parentName})` : selectedSpace.name} (Chủ: ${ownerNames[selectedSpace.ownerId || selectedSpace.OwnerId || selectedSpace.userId || selectedSpace.UserId] || '...'})`
              ) : '-- Chọn mặt bằng --'}
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
                    const validDays = getValidDaysOfWeek(slot.validFrom, slot.validTo);
                    const isDayValid = validDays.includes(day);
                    const isSelected = slot.daysOfWeek.includes(day);
                    return (
                      <TouchableOpacity
                        key={day}
                        disabled={!isDayValid}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: isSelected ? '#00A67E' : (isDayValid ? '#D1D5DB' : '#E5E7EB'), backgroundColor: isSelected ? '#00A67E' : (isDayValid ? '#fff' : '#F3F4F6'), opacity: isDayValid ? 1 : 0.5 }}
                        onPress={() => {
                          setAvailabilities(prev => prev.map((s, i) => {
                            if (i !== index) return s;
                            const newDays = isSelected ? s.daysOfWeek.filter((d: string) => d !== day) : [...s.daysOfWeek, day];
                            return { ...s, daysOfWeek: newDays };
                          }));
                        }}
                      >
                        <Text style={{ color: isSelected ? '#fff' : (isDayValid ? '#374151' : '#9CA3AF'), fontSize: 12 }}>{DAYS_LABEL_VI[day]}</Text>
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
                    <DateField label="Áp dụng từ" value={slot.validFrom} onChange={(v: string) => setAvailabilities(prev => prev.map((s, i) => {
                      if (i !== index) return s;
                      const validDays = getValidDaysOfWeek(v, s.validTo);
                      return { ...s, validFrom: v, daysOfWeek: s.daysOfWeek.filter((d: string) => validDays.includes(d)) };
                    }))} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <DateField label="Áp dụng đến" value={slot.validTo} minDate={slot.validFrom} onChange={(v: string) => setAvailabilities(prev => prev.map((s, i) => {
                      if (i !== index) return s;
                      const validDays = getValidDaysOfWeek(s.validFrom, v);
                      return { ...s, validTo: v, daysOfWeek: s.daysOfWeek.filter((d: string) => validDays.includes(d)) };
                    }))} />
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
          <Text style={styles.label}>Đơn giá (VND) *</Text>
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

        {/* Đơn vị tính */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Đơn vị tính *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
            {[
              { id: 'PerHour', name: '/ Giờ' },
              { id: 'PerDay', name: '/ Ngày' },
              { id: 'PerWeek', name: '/ Tuần' },
              { id: 'PerMonth', name: '/ Tháng' },
              { id: 'PerYear', name: '/ Năm' }
            ].map(unit => (
              <TouchableOpacity
                key={unit.id}
                style={[styles.typeBtn, priceUnit === unit.id && styles.typeBtnActive, { marginRight: 8, paddingHorizontal: 16 }]}
                onPress={() => setPriceUnit(unit.id)}
              >
                <Text style={[styles.typeBtnText, priceUnit === unit.id && styles.typeBtnTextActive]}>{unit.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Thời gian hiệu lực */}
        <Text style={styles.sectionTitle}>Thời gian hiệu lực</Text>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <DateField
              label="Từ ngày"
              value={allowedStartTime}
              disabled={!!(timePolicy && timePolicy.allowedStartTime)}
              onChange={setAllowedStartTime}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <DateField
              label="Đến ngày"
              value={allowedEndTime}
              minDate={allowedStartTime}
              disabled={!!(timePolicy && timePolicy.allowedEndTime)}
              onChange={setAllowedEndTime}
            />
          </View>
        </View>
        {listingType === 1 && timePolicy && timePolicy.message && (
          <Text style={{ fontSize: 13, color: '#059669', fontStyle: 'italic', marginBottom: 10 }}>
            * {timePolicy.message}
          </Text>
        )}

        {/* Banner Quảng Cáo AI Image Editor */}
        <TouchableOpacity
          style={{
            backgroundColor: '#F0F9FF',
            padding: 16,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#BAE6FD',
            marginBottom: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
          onPress={() => {
            router.push('/ai-editor' as any);
          }}
        >
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0369A1', marginBottom: 4 }}>
              ✨ Trải nghiệm AI Image Editor
            </Text>
            <Text style={{ fontSize: 13, color: '#075985', lineHeight: 20 }}>
              Sử dụng AI để tự động thêm vật thể, nội thất, và nâng tầm hình ảnh mặt bằng của bạn!
            </Text>
          </View>
          <Feather name="external-link" size={24} color="#0369A1" />
        </TouchableOpacity>

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
                  <Text style={styles.modalItemTitle}>
                    {item.isPart ? `${item.name} (Thuộc: ${item.parentName})` : item.name}
                  </Text>
                  <Text style={styles.modalItemSub}>
                    Chủ: {ownerNames[item.ownerId || item.OwnerId || item.userId || item.UserId] || '...'}
                  </Text>
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