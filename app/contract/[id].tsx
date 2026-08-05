import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, TextInput
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CONTRACT_STATUS_LABEL, CONTRACT_STATUS_COLOR, formatCurrency, formatDate,
  formatDurationUnit, getSignFlags, getSigningSessionStarted, extractServerMessage
} from '@/utils/contract';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

type SignStep = 'idle' | 'otp_sent' | 'success';

interface UserProfile {
  fullName: string;
  citizenIDNumber: string;
}

export default function ContractDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [contract, setContract] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [lessorProfile, setLessorProfile] = useState<UserProfile | null>(null);
  const [lesseeProfile, setLesseeProfile] = useState<UserProfile | null>(null);

  const [signingSessionStarted, setSigningSessionStarted] = useState(false);
  const [signStep, setSignStep] = useState<SignStep>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadContract = useCallback(async () => {
    try {
      const storedToken = await AsyncStorage.getItem('portal_token');
      const userId = await AsyncStorage.getItem('current_user_id');
      if (!storedToken || !userId) {
        router.replace('/login');
        return;
      }
      setToken(storedToken);
      setCurrentUserId(userId);

      const res = await fetch(`${API_BASE}/api/Contract/GetById/${id}`, {
        headers: { Authorization: `Bearer ${storedToken}`, accept: '*/*' }
      });
      if (!res.ok) throw new Error('Không tải được hợp đồng.');
      const data = await res.json();
      setContract(data);

      const { lessorSigned, lesseeSigned } = getSignFlags(data);
      const status = data?.status ?? data?.Status;
      const isLessor = String(data?.lessorId ?? data?.LessorId) === String(userId);
      const signedByMe = isLessor ? lessorSigned : lesseeSigned;
      setSignStep(signedByMe || status === 'Active' ? 'success' : 'idle');
      setSigningSessionStarted(getSigningSessionStarted(data) || status === 'Active' || lessorSigned || lesseeSigned);

      const lessorId = data?.lessorId ?? data?.LessorId;
      const lesseeId = data?.lesseeId ?? data?.LesseeId;
      const fetchProfile = async (uid: string): Promise<UserProfile | null> => {
        try {
          const pRes = await fetch(`${API_BASE}/api/Profile/user/${uid}`, {
            headers: { Authorization: `Bearer ${storedToken}`, accept: '*/*' }
          });
          if (!pRes.ok) return null;
          const pData = await pRes.json();
          return {
            fullName: pData.fullName || '',
            citizenIDNumber: pData.citizenIDNumber || pData.identityCardNumber || '',
          };
        } catch {
          return null;
        }
      };
      const [lp, lsp] = await Promise.all([
        lessorId ? fetchProfile(String(lessorId)) : Promise.resolve(null),
        lesseeId ? fetchProfile(String(lesseeId)) : Promise.resolve(null),
      ]);
      setLessorProfile(lp);
      setLesseeProfile(lsp);
    } catch (err) {
      console.error('Lỗi tải hợp đồng:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (id) loadContract();
  }, [id, loadContract]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#00A67E" />
      </SafeAreaView>
    );
  }

  if (!contract) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: '#6B7280' }}>Không tìm thấy hợp đồng.</Text>
      </SafeAreaView>
    );
  }

  const status = contract.status ?? contract.Status;
  const lessorId = contract.lessorId ?? contract.LessorId;
  const lesseeId = contract.lesseeId ?? contract.LesseeId;
  const isLessor = String(lessorId) === String(currentUserId);
  const { lessorSigned, lesseeSigned } = getSignFlags(contract);
  const signedByMe = isLessor ? lessorSigned : lesseeSigned;
  const signedByOther = isLessor ? lesseeSigned : lessorSigned;
  const isFullyActive = status === 'Active' || (lessorSigned && lesseeSigned);
  const canModify = isLessor && signStep === 'idle' && status === 'Draft';

  const spaceName = contract.spaceName || contract.space?.name || `Mặt bằng #${contract.spaceId ?? contract.SpaceId ?? '...'}`;

  const handleStartSigningSession = async () => {
    if (!token) return;
    setIsStartingSession(true);
    try {
      const res = await fetch(`${API_BASE}/api/Contract/${contract.id}/start-signing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, accept: '*/*' },
        body: JSON.stringify({ lessorId, lesseeId })
      });
      if (!res.ok) {
        const serverMsg = await extractServerMessage(res);
        if (serverMsg.includes('Draft')) {
          setSigningSessionStarted(true);
          return;
        }
        throw new Error(serverMsg || 'Lỗi khi bắt đầu phiên ký. Vui lòng thử lại!');
      }
      setSigningSessionStarted(true);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleSendOtp = async () => {
    if (!token) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/Contract/${contract.id}/send-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
      });
      if (!res.ok) {
        const serverMsg = await extractServerMessage(res);
        if (serverMsg.includes('đã ký')) {
          setSignStep('success');
          return;
        }
        throw new Error(serverMsg || 'Lỗi khi gửi OTP. Vui lòng thử lại!');
      }
      setSignStep('otp_sent');
      Alert.alert('Đã gửi', 'Mã OTP đã được gửi đến Email của bạn. Vui lòng kiểm tra!');
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidateOtp = async () => {
    if (!token) return;
    if (!otpCode.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mã OTP!');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/Contract/${contract.id}/validate-otp?inputOtp=${encodeURIComponent(otpCode)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
      });
      if (!res.ok) throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn!');
      setSignStep('success');
      Alert.alert('Thành công', 'Ký hợp đồng thành công!');
      loadContract();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Xác nhận', 'Bạn có chắc chắn muốn thu hồi và huỷ bỏ hợp đồng này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Thu hồi', style: 'destructive', onPress: async () => {
          if (!token) return;
          setIsDeleting(true);
          try {
            const res = await fetch(`${API_BASE}/api/Contract/Delete/${contract.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
            });
            if (!res.ok) throw new Error('Thu hồi thất bại. Có thể hợp đồng đã được ký hoặc không tồn tại.');
            Alert.alert('Thành công', 'Đã thu hồi hợp đồng thành công!', [
              { text: 'OK', onPress: () => router.back() }
            ]);
          } catch (err: any) {
            Alert.alert('Lỗi', err.message || 'Lỗi kết nối đến máy chủ.');
          } finally {
            setIsDeleting(false);
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết hợp đồng</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <Text style={styles.spaceName}>{spaceName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${CONTRACT_STATUS_COLOR[status] || '#6B7280'}20` }]}>
            <Text style={[styles.statusText, { color: CONTRACT_STATUS_COLOR[status] || '#6B7280' }]}>
              {CONTRACT_STATUS_LABEL[status] || status}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Các bên tham gia</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Chủ nhà</Text>
            <Text style={styles.rowValue}>{lessorProfile?.fullName || `#${lessorId}`}</Text>
          </View>
          {lessorProfile?.citizenIDNumber ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>CCCD chủ nhà</Text>
              <Text style={styles.rowValue}>{lessorProfile.citizenIDNumber}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Khách thuê</Text>
            <Text style={styles.rowValue}>{lesseeProfile?.fullName || `#${lesseeId}`}</Text>
          </View>
          {lesseeProfile?.citizenIDNumber ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>CCCD khách thuê</Text>
              <Text style={styles.rowValue}>{lesseeProfile.citizenIDNumber}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tài chính</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Giá thuê</Text>
            <Text style={styles.rowValue}>{formatCurrency(contract.price)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Tiền cọc</Text>
            <Text style={styles.rowValue}>{formatCurrency(contract.depositAmount)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lịch trình</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Thời hạn</Text>
            <Text style={styles.rowValue}>{contract.duration} {formatDurationUnit(contract.durationUnit)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Ngày bắt đầu</Text>
            <Text style={styles.rowValue}>{formatDate(contract.startDate)}</Text>
          </View>
          {contract.endDate ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Ngày kết thúc</Text>
              <Text style={styles.rowValue}>{formatDate(contract.endDate)}</Text>
            </View>
          ) : null}
        </View>

        {(contract.acreage || contract.businessPurpose) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Diện tích & mục đích</Text>
            {contract.acreage ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Diện tích</Text>
                <Text style={styles.rowValue}>{contract.acreage} m²</Text>
              </View>
            ) : null}
            {contract.businessPurpose ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Mục đích</Text>
                <Text style={styles.rowValue}>{contract.businessPurpose}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {contract.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nội dung điều khoản</Text>
            <Text style={styles.description}>{contract.description}</Text>
          </View>
        ) : null}

        {/* KHU VỰC KÝ HỢP ĐỒNG */}
        {!isFullyActive && status === 'Draft' && (
          <View style={styles.signSection}>
            <Text style={styles.sectionTitle}>Ký hợp đồng</Text>

            {!signingSessionStarted ? (
              isLessor ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, isStartingSession && { opacity: 0.7 }]}
                  onPress={handleStartSigningSession}
                  disabled={isStartingSession}
                >
                  {isStartingSession ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Bắt Đầu Phiên Ký</Text>}
                </TouchableOpacity>
              ) : (
                <Text style={styles.waitingText}>Đợi chủ nhà bắt đầu phiên ký...</Text>
              )
            ) : signStep === 'success' || signedByMe ? (
              <View style={styles.signedBox}>
                <Feather name="check-circle" size={18} color="#00A67E" />
                <Text style={styles.signedText}>Bạn đã ký hợp đồng này.</Text>
              </View>
            ) : signStep === 'otp_sent' ? (
              <View>
                <TextInput
                  style={styles.otpInput}
                  placeholder="Nhập mã OTP 6 số"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, isProcessing && { opacity: 0.7 }]}
                  onPress={handleValidateOtp}
                  disabled={isProcessing}
                >
                  {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Xác Nhận Ký</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, isProcessing && { opacity: 0.7 }]}
                onPress={handleSendOtp}
                disabled={isProcessing}
              >
                {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Đồng Ý Ký (Nhận mã OTP)</Text>}
              </TouchableOpacity>
            )}

            {signedByOther && signStep !== 'success' && !signedByMe && (
              <Text style={styles.hintText}>Bên còn lại đã ký. Hợp đồng sẽ có hiệu lực khi bạn hoàn tất ký.</Text>
            )}
          </View>
        )}

        {canModify && (
          <TouchableOpacity
            style={[styles.deleteBtn, isDeleting && { opacity: 0.7 }]}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <ActivityIndicator color="#E02424" /> : (
              <>
                <Feather name="trash-2" size={16} color="#E02424" />
                <Text style={styles.deleteBtnText}>Thu hồi hợp đồng</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 },
  spaceName: { fontSize: 20, fontWeight: 'bold', color: '#111827', flex: 1 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontSize: 13, fontWeight: 'bold' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLabel: { fontSize: 13, color: '#6B7280' },
  rowValue: { fontSize: 13, color: '#111827', fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 12 },
  description: { fontSize: 13, color: '#374151', lineHeight: 20 },
  signSection: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  primaryBtn: { backgroundColor: '#00A67E', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  waitingText: { fontSize: 13, color: '#6B7280', fontStyle: 'italic' },
  signedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', padding: 12, borderRadius: 8 },
  signedText: { fontSize: 13, color: '#047857', fontWeight: '600' },
  otpInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111827',
    marginBottom: 12, textAlign: 'center', letterSpacing: 4
  },
  hintText: { fontSize: 12, color: '#D97706', marginTop: 10 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: '#E02424'
  },
  deleteBtnText: { color: '#E02424', fontSize: 14, fontWeight: 'bold' },
});
