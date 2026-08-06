import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

const DURATION_UNITS = [
  { value: 'Days', label: 'Ngày' },
  { value: 'Weeks', label: 'Tuần' },
  { value: 'Months', label: 'Tháng' },
  { value: 'Years', label: 'Năm' },
];

export default function ContractCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const activeChat = params.activeChat ? JSON.parse(params.activeChat as string) : null;
  const existingContract = params.existingContract ? JSON.parse(params.existingContract as string) : null;
  
  const isEditMode = !!existingContract?.id;
  const lessorId = activeChat?.lessorId || activeChat?.LessorId;
  const lesseeId = activeChat?.lesseeId || activeChat?.LesseeId;

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mySpaces, setMySpaces] = useState<any[]>([]);
  const [matchedRequests, setMatchedRequests] = useState<any[]>([]);

  const [contractData, setContractData] = useState({
    spaceId: '',
    primaryBookingRequestId: 0,
    durationUnit: 'Days',
    duration: '1',
    startDate: new Date().toISOString().split('T')[0],
    acreage: '0',
    price: '0',
    depositAmount: '0',
    description: '',
    businessPurpose: '',
    contractSchedules: [],
  });

  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const [showRequestPicker, setShowRequestPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  useEffect(() => {
    const loadAuth = async () => {
      const tk = await AsyncStorage.getItem('portal_token');
      const uid = await AsyncStorage.getItem('current_user_id');
      setToken(tk);
      setCurrentUserId(uid);
    };
    loadAuth();
  }, []);

  useEffect(() => {
    if (!token || !currentUserId) return;
    fetchMySpaces();
    fetchMatchedRequests();
  }, [token, currentUserId]);

  useEffect(() => {
    if (existingContract) {
      setContractData({
        spaceId: existingContract.spaceId ? String(existingContract.spaceId) : '',
        primaryBookingRequestId: existingContract.primaryBookingRequestId || 0,
        durationUnit: existingContract.durationUnit || 'Days',
        duration: String(existingContract.duration || 1),
        startDate: existingContract.startDate ? existingContract.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
        acreage: String(existingContract.acreage || 0),
        price: String(existingContract.price || 0),
        depositAmount: String(existingContract.depositAmount || 0),
        description: existingContract.description || '',
        businessPurpose: existingContract.businessPurpose || '',
        contractSchedules: existingContract.contractSchedules || [],
      });
    }
  }, [existingContract]);

  const fetchMySpaces = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/Space/GetAll?OwnerId=${currentUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMySpaces(Array.isArray(data) ? data : data?.data || data?.items || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMatchedRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/PrimaryBookingRequest/GetAll?status=Approved`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const all = Array.isArray(data) ? data : data?.data || data?.items || [];
        let matched = all.filter((r: any) => String(r.lessorId) === String(lessorId) && String(r.lesseeId) === String(lesseeId));
        
        if (existingContract?.primaryBookingRequestId && !matched.some(r => String(r.id) === String(existingContract.primaryBookingRequestId))) {
          matched = [
            {
              id: existingContract.primaryBookingRequestId,
              offeredPrice: existingContract.price,
              spaceId: existingContract.spaceId,
              duration: existingContract.duration,
            },
            ...matched,
          ];
        }
        
        setMatchedRequests(matched);
        
        if (!existingContract && matched.length === 1) {
          const only = matched[0];
          setContractData(prev => ({
            ...prev,
            primaryBookingRequestId: only.id,
            spaceId: only.spaceId ? String(only.spaceId) : prev.spaceId,
            price: String(only.offeredPrice ?? prev.price),
            duration: String(only.duration ?? prev.duration),
          }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async () => {
    if (!contractData.primaryBookingRequestId) return Alert.alert('Lỗi', 'Vui lòng chọn yêu cầu đặt thuê!');
    if (!contractData.businessPurpose.trim()) return Alert.alert('Lỗi', 'Vui lòng nhập mục đích kinh doanh!');
    
    setIsSubmitting(true);
    const roomId = activeChat?.conversationId || activeChat?.id || activeChat?.Id;

    const payload = {
      conversationId: roomId,
      spaceId: Number(contractData.spaceId) || 0,
      primaryBookingRequestId: Number(contractData.primaryBookingRequestId) || 0,
      durationUnit: contractData.durationUnit,
      duration: Number(contractData.duration),
      startDate: new Date(contractData.startDate).toISOString(),
      acreage: Number(contractData.acreage),
      price: Number(contractData.price),
      depositAmount: Number(contractData.depositAmount),
      description: contractData.description,
      businessPurpose: contractData.businessPurpose,
      contractSchedules: contractData.contractSchedules,
    };

    try {
      if (isEditMode) {
        const updateRes = await fetch(`${API_BASE}/api/Contract/Update/${existingContract.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!updateRes.ok) {
          const errText = await updateRes.text().catch(() => '');
          console.error('[Contract/Update] error:', updateRes.status, errText);
          let errMsg = 'Cập nhật thất bại';
          try { const e = JSON.parse(errText); errMsg = e.message || e.title || e.detail || JSON.stringify(e.errors || e); } catch {}
          throw new Error(errMsg);
        }
        Alert.alert('Thành công', 'Cập nhật hợp đồng thành công!', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        const createPayload = { ...payload, lessorId, lesseeId };
        console.log('[Contract/Create] payload:', JSON.stringify(createPayload));
        const createRes = await fetch(`${API_BASE}/api/Contract/Create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(createPayload),
        });
        if (!createRes.ok) {
          const errText = await createRes.text().catch(() => '');
          console.error('[Contract/Create] error:', createRes.status, errText);
          let errMsg = 'Tạo hợp đồng thất bại';
          try { const e = JSON.parse(errText); errMsg = e.message || e.title || e.detail || JSON.stringify(e.errors || e); } catch {}
          throw new Error(errMsg);
        }
        
        const createdContract = await createRes.json();
        const newContractId = createdContract.id || createdContract.Id;
        
        if (newContractId) {
          await fetch(`${API_BASE}/api/Contract/${newContractId}/share`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        Alert.alert('Thành công', 'Tạo hợp đồng thành công!', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPickerModal = (visible: boolean, setVisible: (v: boolean) => void, title: string, items: any[], onSelect: (val: any) => void, displayKey: string, valKey: string) => (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView>
            {items.map((item, idx) => (
              <TouchableOpacity key={idx} style={styles.modalItem} onPress={() => { onSelect(item[valKey]); setVisible(false); }}>
                <Text style={styles.modalItemText}>{item[displayKey]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeModalBtn} onPress={() => setVisible(false)}>
            <Text style={styles.closeModalText}>Đóng</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>{isEditMode ? 'Sửa hợp đồng' : 'Tạo hợp đồng mới'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Yêu cầu đặt thuê (Bắt buộc) *</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowRequestPicker(true)}>
            <Text style={styles.pickerText}>
              {contractData.primaryBookingRequestId ? `Yêu cầu #${contractData.primaryBookingRequestId}` : 'Chọn yêu cầu thuê'}
            </Text>
            <Feather name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mặt bằng</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowSpacePicker(true)}>
            <Text style={styles.pickerText}>
              {mySpaces.find(s => String(s.id) === String(contractData.spaceId))?.name || 'Chọn mặt bằng'}
            </Text>
            <Feather name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Thời lượng</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={contractData.duration}
              onChangeText={val => setContractData({ ...contractData, duration: val })}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Đơn vị</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowUnitPicker(true)}>
              <Text style={styles.pickerText}>
                {DURATION_UNITS.find(u => u.value === contractData.durationUnit)?.label || 'Ngày'}
              </Text>
              <Feather name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ngày bắt đầu (YYYY-MM-DD) *</Text>
          <TextInput
            style={styles.input}
            value={contractData.startDate}
            onChangeText={val => setContractData({ ...contractData, startDate: val })}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Giá thuê (VND) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={contractData.price}
              onChangeText={val => setContractData({ ...contractData, price: val })}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Tiền cọc (VND) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={contractData.depositAmount}
              onChangeText={val => setContractData({ ...contractData, depositAmount: val })}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Diện tích (m²)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={contractData.acreage}
              onChangeText={val => setContractData({ ...contractData, acreage: val })}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Mục đích kinh doanh *</Text>
            <TextInput
              style={styles.input}
              value={contractData.businessPurpose}
              onChangeText={val => setContractData({ ...contractData, businessPurpose: val })}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mô tả / Điều khoản</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            multiline
            value={contractData.description}
            onChangeText={val => setContractData({ ...contractData, description: val })}
          />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>{isEditMode ? 'Lưu thay đổi' : 'Tạo hợp đồng'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {renderPickerModal(showSpacePicker, setShowSpacePicker, 'Chọn mặt bằng', mySpaces, (val) => setContractData({ ...contractData, spaceId: val }), 'name', 'id')}
      {renderPickerModal(showRequestPicker, setShowRequestPicker, 'Chọn yêu cầu', matchedRequests, (val) => setContractData({ ...contractData, primaryBookingRequestId: val }), 'id', 'id')}
      {renderPickerModal(showUnitPicker, setShowUnitPicker, 'Chọn đơn vị', DURATION_UNITS, (val) => setContractData({ ...contractData, durationUnit: val }), 'label', 'value')}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0D1117'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1 },
  inputGroup: { marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#111827'
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12,
  },
  pickerText: { fontSize: 15, color: '#111827' },
  submitBtn: {
    backgroundColor: '#00A67E', paddingVertical: 14, borderRadius: 8,
    alignItems: 'center', marginTop: 10
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '80%', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 16, textAlign: 'center' },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalItemText: { fontSize: 16, color: '#374151', textAlign: 'center' },
  closeModalBtn: { marginTop: 16, paddingVertical: 12, backgroundColor: '#F3F4F6', borderRadius: 8 },
  closeModalText: { fontSize: 16, fontWeight: 'bold', color: '#374151', textAlign: 'center' }
});
