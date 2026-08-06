import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { formatVnd, QUICK_AMOUNTS, MIN_DEPOSIT_AMOUNT } from '@/utils/wallet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

export default function WalletDepositScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [amountText, setAmountText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const numericAmount = Number(amountText.replace(/\D/g, '')) || 0;
  const isValid = numericAmount > MIN_DEPOSIT_AMOUNT;

  const handlePickQuickAmount = (value: number) => {
    setAmountText(value.toLocaleString('vi-VN'));
    setError('');
  };

  const handleChangeAmount = (text: string) => {
    const digitsOnly = text.replace(/\D/g, '');
    setAmountText(digitsOnly ? Number(digitsOnly).toLocaleString('vi-VN') : '');
    setError('');
  };

  const handleSubmit = async () => {
    if (!isValid) {
      setError(`Số tiền nạp phải lớn hơn ${MIN_DEPOSIT_AMOUNT.toLocaleString('vi-VN')}₫.`);
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const token = await AsyncStorage.getItem('portal_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      const returnUrl = Linking.createURL('wallet-payment-result', { queryParams: { status: 'success' } });
      const cancelUrl = Linking.createURL('wallet-payment-result', { queryParams: { status: 'failed' } });

      const res = await fetch(`${API_BASE}/api/Transaction/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({ amount: numericAmount, returnUrl, cancelUrl })
      });

      if (!res.ok) throw new Error('Không thể tạo lệnh nạp tiền. Vui lòng thử lại.');

      const raw = (await res.text()).trim();
      let checkoutUrl = raw;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') checkoutUrl = parsed;
        else checkoutUrl = parsed?.data || parsed?.checkoutUrl || parsed?.url || parsed?.paymentUrl;
      } catch {
        // raw đã là URL thuần
      }

      if (!checkoutUrl || typeof checkoutUrl !== 'string' || !checkoutUrl.startsWith('http')) {
        throw new Error('Không nhận được đường dẫn thanh toán từ máy chủ.');
      }

      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, returnUrl);

      if (result.type === 'success') {
        const { queryParams } = Linking.parse(result.url);
        const status = queryParams?.status;
        if (status === 'success') {
          Alert.alert('Thành công', 'Giao dịch nạp tiền đang được xử lý. Số dư sẽ được cập nhật sau ít phút.', [
            { text: 'Về ví', onPress: () => router.replace('/wallet') }
          ]);
        } else {
          Alert.alert('Đã huỷ', 'Bạn đã huỷ giao dịch nạp tiền.');
        }
      }
      // type 'cancel' / 'dismiss': người dùng tự đóng trình duyệt giữa chừng, không rõ kết quả — không alert, để họ tự kiểm tra lại số dư ở màn Wallet.
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nạp tiền vào ví</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={styles.label}>Số tiền muốn nạp</Text>
          <View style={styles.amountInputWrap}>
            <TextInput
              style={styles.amountInput}
              keyboardType="numeric"
              placeholder="0"
              value={amountText}
              onChangeText={handleChangeAmount}
            />
            <Text style={styles.amountSuffix}>₫</Text>
          </View>

          <View style={styles.quickAmountGrid}>
            {QUICK_AMOUNTS.map((value) => (
              <TouchableOpacity key={value} style={styles.quickAmountBtn} onPress={() => handlePickQuickAmount(value)}>
                <Text style={styles.quickAmountText}>{formatVnd(value)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.methodCard}>
            <Feather name="credit-card" size={20} color="#00A67E" />
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>PayOS</Text>
              <Text style={styles.methodSubtitle}>ATM / Internet Banking / Quét mã QR</Text>
            </View>
            <Feather name="check-circle" size={18} color="#00A67E" />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={16} color="#E02424" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, (!isValid || isSubmitting) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Tiếp tục thanh toán</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0D1117',
    borderBottomWidth: 1, borderBottomColor: '#0D1117'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  amountInputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, marginBottom: 16
  },
  amountInput: { flex: 1, fontSize: 24, fontWeight: 'bold', color: '#111827', paddingVertical: 16 },
  amountSuffix: { fontSize: 20, color: '#6B7280', marginLeft: 8 },
  quickAmountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  quickAmountBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB'
  },
  quickAmountText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#00A67E'
  },
  methodTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  methodSubtitle: { fontSize: 12, color: '#6B7280' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, marginBottom: 16,
    borderWidth: 1, borderColor: '#FECACA'
  },
  errorText: { color: '#E02424', fontSize: 13, flex: 1 },
  submitBtn: { backgroundColor: '#00A67E', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
