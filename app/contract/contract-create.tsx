import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import {
  CONTRACT_TEMPLATES,
  fillContractTemplate,
  formatSchedule,
  renderMergeValue,
  splitContractHeaderBody,
  ContractMergeData,
  ContractSchedule,
} from '@/utils/contractTemplates';

interface UserProfile {
  userId: string;
  fullName: string;
  citizenIDNumber: string;
  dateOfIssue: string;
}

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
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  // Temporary state for adding a new schedule
  const [newSchedule, setNewSchedule] = useState<ContractSchedule>({ dayOfWeek: 'Monday', startTime: '08:00', endTime: '22:00' });
  const [showDayPicker, setShowDayPicker] = useState(false);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const [lessorProfile, setLessorProfile] = useState<UserProfile | null>(null);
  const [lesseeProfile, setLesseeProfile] = useState<UserProfile | null>(null);
  const lastRenderedRef = React.useRef<Record<string, string>>({});

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
    if (!token) return;
    if (!lessorId && !lesseeId) return;

    const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
      try {
        const res = await fetch(`${API_BASE}/api/Profile/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}`, accept: '*/*' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return {
          userId: data.userId,
          fullName: data.fullName || '',
          citizenIDNumber: data.citizenIDNumber || data.identityCardNumber || '',
          dateOfIssue: data.dateOfIssue || '',
        };
      } catch (err) {
        return null;
      }
    };

    if (lessorId) fetchProfile(String(lessorId)).then(setLessorProfile);
    if (lesseeId) fetchProfile(String(lesseeId)).then(setLesseeProfile);
  }, [token, lessorId, lesseeId]);

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
    } else {
      setSelectedTemplateId('');
      lastRenderedRef.current = {};
    }
  }, [existingContract]);

  // Auto-fill logic
  useEffect(() => {
    if (!selectedTemplateId) return;

    const template = CONTRACT_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (!template) return;

    const spaceName = mySpaces.find(s => String(s.id) === String(contractData.spaceId))?.name || '';
    const spaceAddress = mySpaces.find(s => String(s.id) === String(contractData.spaceId))?.address || '';
    
    const formatCurrencyVal = (val: number | string) => {
      if (!val) return '';
      return parseInt(String(val)).toLocaleString('vi-VN');
    };

    const mergeData: ContractMergeData = {
      MA_YEU_CAU_THUE: contractData.primaryBookingRequestId ? `#${contractData.primaryBookingRequestId}` : '',
      NGAY_LAP_HD: new Date().toLocaleDateString('vi-VN'),
      TEN_MAT_BANG: spaceName,
      DIA_CHI_MAT_BANG: spaceAddress,
      DIEN_TICH: contractData.acreage ? `${contractData.acreage} m2` : '',
      MUC_DICH_KINH_DOANH: contractData.businessPurpose,
      LICH_HOAT_DONG: formatSchedule(contractData.contractSchedules),
      GIA_THUE: contractData.price ? `${formatCurrencyVal(contractData.price)} VNĐ/tháng` : '',
      TIEN_COC: contractData.depositAmount ? `${formatCurrencyVal(contractData.depositAmount)} VNĐ` : '',
      THOI_HAN_THUE: `${contractData.duration} ${DURATION_UNITS.find(u => u.value === contractData.durationUnit)?.label?.toLowerCase() || ''}`,
      NGAY_BAT_DAU: contractData.startDate ? new Date(contractData.startDate).toLocaleDateString('vi-VN') : '',

      BEN_A_HO_TEN: lessorProfile?.fullName,
      BEN_A_CCCD: lessorProfile?.citizenIDNumber,
      BEN_A_CCCD_NGAY_CAP: lessorProfile?.dateOfIssue ? new Date(lessorProfile.dateOfIssue).toLocaleDateString('vi-VN') : '',

      BEN_B_HO_TEN: lesseeProfile?.fullName,
      BEN_B_CCCD: lesseeProfile?.citizenIDNumber,
      BEN_B_CCCD_NGAY_CAP: lesseeProfile?.dateOfIssue ? new Date(lesseeProfile.dateOfIssue).toLocaleDateString('vi-VN') : '',
    };

    let newDesc = contractData.description || '';
    
    if (!newDesc || !lastRenderedRef.current || Object.keys(lastRenderedRef.current).length === 0) {
      newDesc = fillContractTemplate(template, mergeData);
    } else {
      (Object.keys(mergeData) as (keyof ContractMergeData)[]).forEach((key) => {
        const newValue = renderMergeValue(key, mergeData[key]);
        const oldValue = lastRenderedRef.current[key];
        if (oldValue && oldValue !== newValue && newDesc.includes(oldValue)) {
          newDesc = newDesc.split(oldValue).join(newValue);
        }
      });
    }

    const rendered: Record<string, string> = {};
    (Object.keys(mergeData) as (keyof ContractMergeData)[]).forEach((key) => {
      rendered[key] = renderMergeValue(key, mergeData[key]);
    });
    lastRenderedRef.current = rendered;

    if (newDesc !== contractData.description) {
      setContractData(prev => ({ ...prev, description: newDesc }));
    }
  }, [
    selectedTemplateId, 
    contractData.spaceId, 
    contractData.primaryBookingRequestId, 
    contractData.acreage, 
    contractData.businessPurpose, 
    contractData.contractSchedules, 
    contractData.price, 
    contractData.depositAmount, 
    contractData.duration, 
    contractData.durationUnit, 
    contractData.startDate, 
    mySpaces, 
    lessorProfile, 
    lesseeProfile
  ]);

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
        
        if (existingContract?.primaryBookingRequestId && !matched.some((r: any) => String(r.id) === String(existingContract.primaryBookingRequestId))) {
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
    if (!contractData.spaceId) return Alert.alert('Lỗi', 'Vui lòng chọn mặt bằng!');
    if (!contractData.duration || !contractData.durationUnit) return Alert.alert('Lỗi', 'Vui lòng nhập thời lượng!');
    if (!contractData.startDate) return Alert.alert('Lỗi', 'Vui lòng chọn ngày bắt đầu!');
    if (!contractData.price) return Alert.alert('Lỗi', 'Vui lòng nhập giá thuê!');
    if (!contractData.depositAmount) return Alert.alert('Lỗi', 'Vui lòng nhập tiền cọc!');
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

          // Send message to chat via API since we don't have direct SignalR connection here
          const roomId = activeChat?.conversationId || activeChat?.id || activeChat?.Id;
          if (roomId) {
            await fetch(`${API_BASE}/api/Message/SendMessage`, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                conversationId: roomId,
                content: `📄 Tôi vừa tạo và gửi một Hợp đồng (Mã: #${newContractId}). Vui lòng kiểm tra và xác nhận nhé!`
              })
            });
          }
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
          <Text style={styles.label}>Lịch hoạt động</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowScheduleModal(true)}>
            <Text style={styles.pickerText}>
              {contractData.contractSchedules.length > 0 
                ? `${contractData.contractSchedules.length} khung giờ đã chọn` 
                : 'Quản lý lịch hoạt động (tuỳ chọn)'}
            </Text>
            <Feather name="clock" size={20} color="#6B7280" />
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
          <Text style={styles.label}>Ngày bắt đầu *</Text>
          {Platform.OS === 'web' ? (
            React.createElement('input', {
              type: 'date',
              value: contractData.startDate || '',
              onChange: (e: any) => setContractData({ ...contractData, startDate: e.target.value }),
              style: { padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', width: '100%', fontSize: 15, boxSizing: 'border-box', backgroundColor: '#fff', color: '#111827', cursor: 'pointer' }
            })
          ) : (
            <>
              <TouchableOpacity
                style={[styles.input, { justifyContent: 'center' }]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={{ color: contractData.startDate ? '#111827' : '#9CA3AF' }}>
                  {contractData.startDate || 'Chọn ngày'}
                </Text>
              </TouchableOpacity>
              {Platform.OS === 'android' && showStartDatePicker && (
                <DateTimePicker
                  value={new Date(contractData.startDate || Date.now())}
                  mode="date"
                  display="default"
                  themeVariant="light"
                  onChange={(event, selectedDate) => {
                    setShowStartDatePicker(false);
                    if (selectedDate) {
                      setContractData({ ...contractData, startDate: selectedDate.toISOString().slice(0, 10) });
                    }
                  }}
                />
              )}
              {Platform.OS === 'ios' && (
                <Modal visible={showStartDatePicker} transparent animationType="slide">
                  <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowStartDatePicker(false)} />
                    <View style={{ backgroundColor: '#fff', paddingBottom: insets.bottom || 20 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                        <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                          <Text style={{ color: '#6B7280', fontWeight: 'bold', fontSize: 16 }}>Hủy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                          <Text style={{ color: '#00A67E', fontWeight: 'bold', fontSize: 16 }}>Xong</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={new Date(contractData.startDate || Date.now())}
                        mode="date"
                        display="spinner"
                        themeVariant="light"
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            setContractData({ ...contractData, startDate: selectedDate.toISOString().slice(0, 10) });
                          }
                        }}
                      />
                    </View>
                  </View>
                </Modal>
              )}
            </>
          )}
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
            style={[styles.input, { height: 180, textAlignVertical: 'top' }]}
            multiline
            value={contractData.description}
            onChangeText={val => setContractData({ ...contractData, description: val })}
          />
        </View>

        {!isEditMode && (
          <View style={[styles.inputGroup, { marginTop: 16 }]}>
            <Text style={styles.label}>Mẫu hợp đồng</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 8, fontStyle: 'italic' }}>
              Vui lòng nhập đầy đủ thông tin phía trên trước khi chọn mẫu hợp đồng.
            </Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTemplatePicker(true)}>
              <Text style={styles.pickerText}>
                {CONTRACT_TEMPLATES.find(t => t.id === selectedTemplateId)?.label || 'Chọn mẫu hợp đồng (tuỳ chọn)'}
              </Text>
              <Feather name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <TouchableOpacity 
            style={[styles.submitBtn, { flex: 1, backgroundColor: '#3B82F6' }]} 
            onPress={() => setShowPreviewModal(true)}
          >
            <Text style={styles.submitBtnText}>Xem trước</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.submitBtn, { flex: 1 }]} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>{isEditMode ? 'Lưu thay đổi' : 'Tạo hợp đồng'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {renderPickerModal(showSpacePicker, setShowSpacePicker, 'Chọn mặt bằng', mySpaces, (val) => setContractData({ ...contractData, spaceId: val }), 'name', 'id')}
      {renderPickerModal(showRequestPicker, setShowRequestPicker, 'Chọn yêu cầu', matchedRequests, (val) => setContractData({ ...contractData, primaryBookingRequestId: val }), 'id', 'id')}
      {renderPickerModal(showUnitPicker, setShowUnitPicker, 'Chọn đơn vị', DURATION_UNITS, (val) => setContractData({ ...contractData, durationUnit: val }), 'label', 'value')}
      {renderPickerModal(showTemplatePicker, setShowTemplatePicker, 'Chọn mẫu hợp đồng', CONTRACT_TEMPLATES, (val) => setSelectedTemplateId(val), 'label', 'id')}
      {renderPickerModal(showDayPicker, setShowDayPicker, 'Chọn thứ', [
        { label: 'Thứ Hai', value: 'Monday' }, { label: 'Thứ Ba', value: 'Tuesday' },
        { label: 'Thứ Tư', value: 'Wednesday' }, { label: 'Thứ Năm', value: 'Thursday' },
        { label: 'Thứ Sáu', value: 'Friday' }, { label: 'Thứ Bảy', value: 'Saturday' },
        { label: 'Chủ Nhật', value: 'Sunday' }
      ], (val) => { setNewSchedule({ ...newSchedule, dayOfWeek: val }); setTimeout(() => setShowScheduleModal(true), 350); }, 'label', 'value')}

      {/* Preview Modal */}
      <Modal visible={showPreviewModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
            <TouchableOpacity onPress={() => setShowPreviewModal(false)} style={{ padding: 4 }}>
              <Feather name="x" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 16 }}>Xem trước Hợp đồng</Text>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            {contractData.description ? (() => {
              const { header, body } = splitContractHeaderBody(contractData.description);
              return (
                <>
                  {!!header && (
                    <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: 'bold', color: '#1E293B', lineHeight: 22, marginBottom: 16 }}>{header}</Text>
                  )}
                  <Text style={{ textAlign: 'left', fontSize: 14, color: '#374151', lineHeight: 24 }}>{body}</Text>
                </>
              );
            })() : (
              <Text style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Chưa có nội dung. Vui lòng chọn mẫu hợp đồng.</Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Schedule Modal */}
      <Modal visible={showScheduleModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '90%' }]}>
            <Text style={styles.modalTitle}>Quản lý Lịch hoạt động</Text>
            <ScrollView style={{ maxHeight: 200, marginBottom: 16 }}>
              {contractData.contractSchedules.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#6B7280', marginVertical: 10 }}>Chưa có khung giờ nào.</Text>
              ) : (
                contractData.contractSchedules.map((sch: any, idx: number) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                    <Text style={{ fontSize: 15, color: '#111827' }}>{sch.dayOfWeek} ({sch.startTime} - {sch.endTime})</Text>
                    <TouchableOpacity onPress={() => {
                      const updated = [...contractData.contractSchedules];
                      updated.splice(idx, 1);
                      setContractData({ ...contractData, contractSchedules: updated });
                    }}>
                      <Feather name="trash-2" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            
            <View style={{ backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <Text style={{ fontWeight: '600', marginBottom: 8, color: '#374151' }}>Thêm khung giờ mới</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <TouchableOpacity style={[styles.input, { flex: 1, marginRight: 8, justifyContent: 'center' }]} onPress={() => {
                  setShowScheduleModal(false);
                  setTimeout(() => setShowDayPicker(true), 350);
                }}>
                  <Text>{newSchedule.dayOfWeek}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginRight: 8 }]} 
                  placeholder="Giờ BĐ (vd: 08:00)" 
                  value={newSchedule.startTime}
                  onChangeText={(val) => setNewSchedule({ ...newSchedule, startTime: val })}
                />
                <TextInput 
                  style={[styles.input, { flex: 1 }]} 
                  placeholder="Giờ KT (vd: 22:00)" 
                  value={newSchedule.endTime}
                  onChangeText={(val) => setNewSchedule({ ...newSchedule, endTime: val })}
                />
              </View>
              <TouchableOpacity 
                style={{ backgroundColor: '#10B981', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 10 }}
                onPress={() => {
                  if (!newSchedule.startTime || !newSchedule.endTime) return Alert.alert('Lỗi', 'Vui lòng nhập giờ bắt đầu và kết thúc');
                  setContractData({ ...contractData, contractSchedules: [...contractData.contractSchedules, newSchedule] as any });
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Thêm</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowScheduleModal(false)}>
              <Text style={styles.closeModalText}>Xong</Text>
            </TouchableOpacity>
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
