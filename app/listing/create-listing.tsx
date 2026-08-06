import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
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
  const [allowedStartTime, setAllowedStartTime] = useState(getSafeDateOnly());
  const [allowedEndTime, setAllowedEndTime] = useState(getNextMonthDate());

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
        const res = await fetch(
          `${API_BASE}/api/Space/GetAll?OwnerId=${encodeURIComponent(currentUserId)}`,
          {
            headers: { Authorization: `Bearer ${token}`, accept: '*/*' },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setMySpaces(Array.isArray(data) ? data : data?.data || []);
        }
      } catch (err) {
        console.error('Lỗi lấy danh sách mặt bằng:', err);
      }
    };
    fetchSpaces();
  }, [token, currentUserId]);

  const selectedSpace = mySpaces.find(s => (s.id || s.Id) === spaceId);

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

    setIsSubmitting(true);

    // Payload matches web ListingForm.tsx line 311-319
    const payload = {
      spaceId: Number(spaceId),
      allowedStartTime: allowedStartTime.substring(0, 10),
      allowedEndTime: allowedEndTime.substring(0, 10),
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      listingPictures: [],
    };

    try {
      const res = await fetch(`${API_BASE}/api/Listing/Create`, {
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
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Từ ngày</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={allowedStartTime}
              onChangeText={setAllowedStartTime}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Đến ngày</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={allowedEndTime}
              onChangeText={setAllowedEndTime}
            />
          </View>
        </View>

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
  hintText: { fontSize: 12, color: '#6B7280', marginTop: 4 },

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
