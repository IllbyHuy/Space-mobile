import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { splitContractHeaderBody } from '@/utils/contractTemplates';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

export default function ContractDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { contractId } = params;
  const insets = useSafeAreaInsets();

  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [contract, setContract] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [signingSessionStarted, setSigningSessionStarted] = useState(false);
  const [signStep, setSignStep] = useState<'idle' | 'otp_sent' | 'success'>('idle');
  const [otpCode, setOtpCode] = useState('');

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
    if (token && currentUserId && contractId) {
      fetchContract();
    }
  }, [token, currentUserId, contractId]);

  const fetchContract = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/Contract/GetById/${contractId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Không thể tải hợp đồng');
      const data = await res.json();
      setContract(data);
      
      const isLessor = String(data.lessorId || data.LessorId) === String(currentUserId);
      const lessorSigned = data.lessorSignature || data.LessorSignature || false;
      const lesseeSigned = data.lesseeSignature || data.LesseeSignature || false;
      
      const signedByMe = isLessor ? lessorSigned : lesseeSigned;
      const status = data.status || data.Status;
      
      setSignStep(signedByMe || status === 'Active' ? 'success' : 'idle');
      
      const sessionStarted = data.signingSessionStarted || data.SigningSessionStarted || status === 'Active' || lessorSigned || lesseeSigned;
      setSigningSessionStarted(sessionStarted);
      
      if (status === 'Active' || (lessorSigned && lesseeSigned)) {
        fetchSnapshot(data.id || data.Id);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSnapshot = async (id: any) => {
    try {
      const res = await fetch(`${API_BASE}/api/Contract/GetSnapshotById/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSnapshot(await res.json());
      }
    } catch (err) {
      console.log('Error fetching snapshot:', err);
    }
  };

  const handleStartSession = async () => {
    setIsProcessing(true);
    try {
      const lessorId = contract?.lessorId || contract?.LessorId;
      const lesseeId = contract?.lesseeId || contract?.LesseeId;

      const res = await fetch(`${API_BASE}/api/Contract/${contractId}/start-signing`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ lessorId, lesseeId })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || 'Lỗi khi bắt đầu phiên ký');
      }
      setSigningSessionStarted(true);
      Alert.alert('Thành công', 'Đã bắt đầu phiên ký. Bây giờ cả hai bên có thể lấy mã OTP.');
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendOTP = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/Contract/${contractId}/send-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        if (typeof errText === 'string' && errText.includes('đã ký')) {
          setSignStep('success');
          return;
        }
        let msg = errText;
        try { const p = JSON.parse(errText); msg = p.message || errText; } catch {}
        throw new Error(msg || 'Lỗi khi gửi OTP');
      }
      setSignStep('otp_sent');
      Alert.alert('Thành công', 'Mã OTP đã được gửi đến Email của bạn.');
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidateOTP = async () => {
    if (!otpCode.trim()) return Alert.alert('Lỗi', 'Vui lòng nhập mã OTP');
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/Contract/${contractId}/validate-otp?inputOtp=${encodeURIComponent(otpCode)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn');
      setSignStep('success');
      Alert.alert('Thành công', 'Ký hợp đồng thành công!');
      fetchContract(); // Refresh
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#00A67E" />
      </View>
    );
  }

  if (!contract) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ fontSize: 16, color: '#6B7280' }}>Không tìm thấy hợp đồng</Text>
      </View>
    );
  }

  const isLessor = String(contract.lessorId || contract.LessorId) === String(currentUserId);
  const status = contract.status || contract.Status;
  
  // Decide which text to render (snapshot or live description)
  const contentToRender = snapshot?.contractData?.description || contract.description || '';

  // Split header (quốc hiệu, tiêu ngữ) from body — center header, left-align body
  const { header: contractHeader, body: contractBody } = splitContractHeaderBody(contentToRender);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết Hợp đồng</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }}>
        <View style={[styles.statusBadge, status !== 'Active' && { backgroundColor: '#F59E0B' }]}>
          <Text style={styles.statusText}>{status === 'Active' ? 'ĐÃ CÓ HIỆU LỰC' : 'CHỜ KÝ'}</Text>
        </View>

        <View style={styles.card}>
          {contentToRender ? (
            <>
              {!!contractHeader && (
                <Text style={styles.contractHeaderText}>{contractHeader}</Text>
              )}
              <Text style={styles.contractBodyText}>{contractBody}</Text>
            </>
          ) : (
            <Text style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Chưa có nội dung hợp đồng.</Text>
          )}
        </View>

        {/* Action Panel */}
        <View style={[styles.card, { marginTop: 16, marginBottom: 40 }]}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>Xác nhận Hợp đồng</Text>
          
          {signStep === 'success' ? (
            <View style={{ padding: 16, backgroundColor: '#D1FAE5', borderRadius: 8, alignItems: 'center' }}>
              <Feather name="check-circle" size={32} color="#059669" />
              <Text style={{ marginTop: 8, color: '#065F46', fontWeight: 'bold' }}>Bạn đã ký hợp đồng này</Text>
            </View>
          ) : (
            <View>
              {isLessor && !signingSessionStarted && (
                <TouchableOpacity style={styles.actionBtn} onPress={handleStartSession} disabled={isProcessing}>
                  {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Bắt đầu phiên ký</Text>}
                </TouchableOpacity>
              )}

              {!isLessor && !signingSessionStarted && (
                <View style={{ padding: 12, backgroundColor: '#FEF3C7', borderRadius: 8 }}>
                  <Text style={{ color: '#92400E', textAlign: 'center' }}>Đang chờ chủ nhà bắt đầu phiên ký...</Text>
                </View>
              )}

              {signingSessionStarted && signStep === 'idle' && (
                <TouchableOpacity style={styles.actionBtn} onPress={handleSendOTP} disabled={isProcessing}>
                  {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Lấy mã OTP Ký Hợp Đồng</Text>}
                </TouchableOpacity>
              )}

              {signStep === 'otp_sent' && (
                <View style={{ gap: 12 }}>
                  <Text style={{ fontSize: 14, color: '#374151' }}>Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra và nhập vào bên dưới:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập mã OTP..."
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={handleValidateOTP} disabled={isProcessing}>
                    {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Xác nhận ký</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSendOTP} style={{ alignItems: 'center' }} disabled={isProcessing}>
                    <Text style={{ color: '#3B82F6', fontWeight: '500' }}>Gửi lại mã OTP</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0D1117'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contractHeaderText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    lineHeight: 22,
    marginBottom: 16,
  },
  contractBodyText: {
    textAlign: 'left',
    fontSize: 14,
    color: '#374151',
    lineHeight: 24,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  actionBtn: {
    backgroundColor: '#00A67E',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  }
});
