import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

const CustomCheckbox = ({ value, onValueChange, label }: any) => (
  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }} onPress={() => onValueChange(!value)}>
    <View style={{ width: 20, height: 20, borderWidth: 1, borderColor: '#00A67E', borderRadius: 4, marginRight: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: value ? '#00A67E' : 'transparent' }}>
      {value && <Feather name="check" size={14} color="#fff" />}
    </View>
    {label && <Text style={{ color: '#374151', flex: 1 }}>{label}</Text>}
  </TouchableOpacity>
);

export default function ExternalContractCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const activeChat = params.activeChat ? JSON.parse(params.activeChat as string) : null;
  const isLessor = String(activeChat?.lessorId || activeChat?.LessorId) === String(currentUserId);
  const otherUserId = isLessor 
    ? (activeChat?.lesseeId || activeChat?.LesseeId) 
    : (activeChat?.lessorId || activeChat?.LessorId);
  const otherUserName = isLessor 
    ? (activeChat?.lesseeUserName || activeChat?.LesseeUserName || activeChat?.lesseeName || activeChat?.LesseeName || 'Khách thuê')
    : (activeChat?.lessorUserName || activeChat?.LessorUserName || activeChat?.lessorName || activeChat?.LessorName || 'Chủ nhà');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [mySpaces, setMySpaces] = useState<any[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [matchedRequests, setMatchedRequests] = useState<any[]>([]);

  const [contractData, setContractData] = useState({
    spaceId: '',
    primaryBookingRequestId: 0,
  });

  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const [showRequestPicker, setShowRequestPicker] = useState(false);

  const [canShowShareCheckbox, setCanShowShareCheckbox] = useState(false);
  const [canShareSpace, setCanShareSpace] = useState(false);
  
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken') || await AsyncStorage.getItem('portal_token');
        const storedUser = await AsyncStorage.getItem('userInfo');
        const uid = await AsyncStorage.getItem('current_user_id');
        if (storedToken) {
          setToken(storedToken);
          if (uid) setCurrentUserId(uid);
          else if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setCurrentUserId(parsed.id || parsed.Id);
          }
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin auth:", err);
      }
    };
    loadAuth();
  }, []);

  useEffect(() => {
    const fetchSpaces = async () => {
      if (!currentUserId || !token) return;
      try {
        const res = await fetch(`${API_BASE}/api/Space/GetAll?OwnerId=${currentUserId}`, {
          headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
        });
        let ownerSpaces: any[] = [];
        if (res.ok) {
          try {
            const text = await res.text();
            const data = text ? JSON.parse(text) : [];
            ownerSpaces = Array.isArray(data) ? data : (data?.data || data?.items || []);
          } catch (e) {
            console.log("Error parsing Space/GetAll:", e);
          }
        }

        const resUsage = await fetch(`${API_BASE}/api/SpaceUsageRight/Mine`, {
            headers: { Authorization: `Bearer ${token}`, accept: '*/*' },
        });
        let usageSpaces: any[] = [];
        if (resUsage.ok) {
            try {
              const text = await resUsage.text();
              const usageData = text ? JSON.parse(text) : [];
              const rights = Array.isArray(usageData) ? usageData : (usageData?.data || usageData?.items || []);
              const shareableRights = rights.filter((r: any) => r.canShare === true || r.CanShare === true);
              const spacePromises = shareableRights.map((r: any) =>
                  fetch(`${API_BASE}/api/Space/GetById/${r.spaceId || r.SpaceId}`, {
                      headers: { Authorization: `Bearer ${token}`, accept: '*/*' },
                  })
                  .then(res => res.ok ? res.text().then(t => t ? JSON.parse(t) : null).then(d => (d?.data || d?.items || d)).catch(() => null) : null)
                  .catch(() => null)
              );
              const resolvedSpaces = await Promise.all(spacePromises);
              usageSpaces = resolvedSpaces.filter(Boolean);
            } catch (e) {
              console.log("Error parsing SpaceUsageRight/Mine:", e);
            }
        }

        const allSpaces = [...ownerSpaces, ...usageSpaces];
        const uniqueSpaces = Array.from(new Map(allSpaces.map((item) => [item.id || item.Id, item])).values());
        
        setMySpaces(uniqueSpaces);

        // Fetch owner names for spaces not owned by current user
        const ownerIds = Array.from(new Set(uniqueSpaces.map(s => s.ownerId || s.OwnerId || s.userId || s.UserId).filter(Boolean)));
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
        
      } catch (err) {
        console.error("Lỗi lấy không gian:", err);
      }
    };
    fetchSpaces();
  }, [currentUserId, token]);

  useEffect(() => {
    const checkSpaceRight = async () => {
      if (!contractData.spaceId || !token) {
        setCanShowShareCheckbox(false);
        setCanShareSpace(false);
        return;
      }
      
      const selectedSpace = mySpaces.find(s => String(s.id || s.Id) === String(contractData.spaceId));
      let isOwner = false;
      if (selectedSpace) {
        isOwner = String(selectedSpace.ownerId || selectedSpace.OwnerId || selectedSpace.userId) === String(currentUserId);
      }

      setCanShowShareCheckbox(isOwner);
      if (!isOwner) {
        setCanShareSpace(false);
      }
    };
    checkSpaceRight();
  }, [contractData.spaceId, token, mySpaces, currentUserId]);

  useEffect(() => {
    const fetchBookings = async () => {
      if (!token || !contractData.spaceId) {
        setMatchedRequests([]);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/BookingRequest/GetAll`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const allReqs = Array.isArray(data) ? data : (data?.data || data?.items || []);
          const filtered = allReqs.filter((b: any) =>
            String(b.spaceId || b.SpaceId) === String(contractData.spaceId) &&
            String(b.userId || b.UserId) === String(otherUserId)
          );
          setMatchedRequests(filtered);
        }
      } catch (err) {
        console.error("Lỗi Booking Request:", err);
      }
    };
    fetchBookings();
  }, [contractData.spaceId, token, otherUserId]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Bạn cần cấp quyền truy cập thư viện ảnh để tải lên hợp đồng.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setImages((prev) => [...prev, ...result.assets]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!contractData.spaceId) {
      Alert.alert("Lỗi", "Vui lòng chọn không gian/mặt bằng!");
      return;
    }
    if (images.length === 0) {
      Alert.alert("Lỗi", "Vui lòng tải lên ít nhất một ảnh hợp đồng!");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        spaceId: contractData.spaceId,
        lesseeId: otherUserId,
        conversationId: activeChat?.conversationId || activeChat?.id || activeChat?.Id,
        canShare: canShareSpace,
        canGrantSharePermission: canShareSpace,
        primaryBookingRequestId: contractData.primaryBookingRequestId || undefined
      };

      const res = await fetch(`${API_BASE}/api/ExternalContract/Create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Lỗi tạo hợp đồng ngoại');
      }

      const createdData = await res.json();
      const contractId = createdData?.data?.id || createdData?.data?.Id || createdData?.id || createdData?.Id;

      if (!contractId) {
        throw new Error('Không lấy được ID của hợp đồng vừa tạo');
      }

      // Upload ảnh
      for (const img of images) {
        const formData = new FormData();
        const localUri = img.uri;
        const filename = localUri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;

        formData.append('file', {
          uri: localUri,
          name: filename,
          type
        } as any);
        formData.append('contractId', contractId.toString());
        formData.append('externalContractId', contractId.toString());

        await fetch(`${API_BASE}/api/Picture`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
      }

      // Gửi thông báo trong chat
      if (activeChat) {
        const roomId = activeChat?.conversationId || activeChat?.id || activeChat?.Id;
        const connection = (global as any).chatConnection; 
        if (connection && roomId) {
          try {
            await connection.invoke("SendMessageToGroup", roomId, contractId.toString());
          } catch(e) {
            console.error("SignalR err:", e);
          }
        }
      }

      if (Platform.OS === 'web') {
        window.alert('Hợp đồng đã được tạo và gửi đi chờ xác nhận.');
        router.back();
      } else {
        Alert.alert('Thành công', 'Hợp đồng đã được tạo và gửi đi chờ xác nhận.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
      
    } catch (err: any) {
      console.error(err);
      if (Platform.OS === 'web') {
        window.alert(err.message || 'Đã có lỗi xảy ra');
      } else {
        Alert.alert('Lỗi', err.message || 'Đã có lỗi xảy ra');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPickerModal = (visible: boolean, setVisible: (v: boolean) => void, title: string, items: any[], onSelect: (val: any) => void, displayKey: string, valKey: string) => (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 300, width: '100%' }}>
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
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {renderPickerModal(showSpacePicker, setShowSpacePicker, 'Chọn không gian', mySpaces.map(s => {
        const parentName = s.parentSpaceName || s.ParentSpaceName;
        const spaceName = s.name || s.Name;
        const ownerId = s.ownerId || s.OwnerId || s.userId || s.UserId;
        const oName = ownerNames[ownerId] || 'Unknown';
        const isOwner = String(ownerId) === String(currentUserId);
        const namePart = parentName ? `${parentName} - ${spaceName}` : spaceName;
        return {
          ...s,
          displayName: isOwner ? namePart : `${namePart} (Chủ: ${oName})`,
          id: s.id || s.Id
        };
      }), (val) => setContractData({ ...contractData, spaceId: val }), 'displayName', 'id')}

      {renderPickerModal(showRequestPicker, setShowRequestPicker, 'Liên kết Yêu cầu', [
        { id: 0, displayLabel: '-- Không liên kết --' },
        ...matchedRequests.map(req => {
          const space = mySpaces.find(s => String(s.id || s.Id) === String(req.spaceId));
          return {
            ...req,
            displayLabel: `Yêu cầu #${req.id} - ${space?.name || 'Mặt bằng trống'} - ${Number(req.offeredPrice || 0).toLocaleString('vi-VN')} VNĐ`
          };
        })
      ], (val) => setContractData({ ...contractData, primaryBookingRequestId: val }), 'displayLabel', 'id')}

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tải ảnh hợp đồng giấy</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.partiesContainer}>
            <View style={styles.partyBox}>
              <Text style={styles.partyLabel}>Bên cho thuê (A)</Text>
              <Text style={styles.partyName}>Bạn</Text>
            </View>
            <View style={styles.partyBox}>
              <Text style={styles.partyLabel}>Bên thuê (B)</Text>
              <Text style={styles.partyName}>{otherUserName}</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Chọn không gian <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowSpacePicker(true)}>
              <Text style={styles.pickerText}>
                {contractData.spaceId 
                  ? (() => {
                      const s = mySpaces.find(sp => String(sp.id || sp.Id) === String(contractData.spaceId));
                      if (s) {
                        const parentName = s.parentSpaceName || s.ParentSpaceName;
                        const spaceName = s.name || s.Name;
                        const ownerId = s.ownerId || s.OwnerId || s.userId || s.UserId;
                        const oName = ownerNames[ownerId] || 'Unknown';
                        const isOwner = String(ownerId) === String(currentUserId);
                        const namePart = parentName ? `${parentName} - ${spaceName}` : spaceName;
                        return isOwner ? namePart : `${namePart} (Chủ: ${oName})`;
                      }
                      return 'Chọn không gian';
                    })()
                  : '-- Chọn không gian --'}
              </Text>
              <Feather name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {matchedRequests.length > 0 && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Liên kết Yêu cầu (Tùy chọn)</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowRequestPicker(true)}>
                <Text style={styles.pickerText}>
                  {contractData.primaryBookingRequestId 
                    ? `Yêu cầu #${contractData.primaryBookingRequestId}`
                    : '-- Không liên kết --'}
                </Text>
                <Feather name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          )}

          {canShowShareCheckbox && (
            <CustomCheckbox
              label="Cho phép tạo hợp đồng (cho thuê lại) dựa vào mặt bằng này."
              value={canShareSpace}
              onValueChange={setCanShareSpace}
            />
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tải ảnh hợp đồng lên <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
              <Feather name="upload-cloud" size={32} color="#00A67E" />
              <Text style={{ marginTop: 8, color: '#374151', fontWeight: '500' }}>Bấm vào đây để chọn ảnh</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Hỗ trợ JPG, PNG (Tối đa nhiều ảnh)</Text>
            </TouchableOpacity>

            {images.length > 0 && (
              <ScrollView horizontal style={styles.imagePreviewContainer}>
                {images.map((img, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image source={{ uri: img.uri }} style={styles.previewImage} />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(index)}>
                      <Feather name="x" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} 
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
          ) : (
            <Feather name="check" size={20} color="#fff" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.submitBtnText}>{isSubmitting ? 'Đang xử lý...' : 'Xác nhận tải lên'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  content: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  partiesContainer: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 16, gap: 12 },
  partyBox: { flex: 1 },
  partyLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  partyName: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  pickerContainer: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' },
  uploadBox: { borderWidth: 1, borderColor: '#D1D5DB', borderStyle: 'dashed', borderRadius: 8, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  imagePreviewContainer: { marginTop: 12, flexDirection: 'row' },
  imageWrapper: { width: 80, height: 80, borderRadius: 8, marginRight: 12, position: 'relative' },
  previewImage: { width: '100%', height: '100%', borderRadius: 8 },
  removeImageBtn: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  submitBtn: { backgroundColor: '#00A67E', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 8, shadowColor: '#00A67E', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: '#F9FAFB' },
  pickerText: { fontSize: 14, color: '#374151' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', maxHeight: '70%', backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#111827', textAlign: 'center' },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalItemText: { fontSize: 16, color: '#374151' },
  closeModalBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8 },
  closeModalText: { fontSize: 16, fontWeight: 'bold', color: '#111827' }
});
