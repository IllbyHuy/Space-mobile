import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatVnd, type WalletAccount } from '@/utils/wallet';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

export default function WalletScreen() {
  const router = useRouter();
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadWallet = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('portal_token');
      if (!token) {
        router.replace('/login');
        return;
      }
      const res = await fetch(`${API_BASE}/api/Wallet/own`, {
        headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
      });
      if (!res.ok) throw new Error('Không thể tải thông tin ví. Vui lòng thử lại.');
      setAccount(await res.json());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải thông tin ví.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadWallet();
    }, [loadWallet])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadWallet();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ví & Thanh toán</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#00A67E']} />}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color="#00A67E" style={{ marginTop: 60 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={20} color="#E02424" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Số dư khả dụng</Text>
              <Text style={styles.balanceValue}>{formatVnd(account?.balance || 0)}</Text>
            </View>

            <TouchableOpacity style={styles.depositBtn} onPress={() => router.push('/wallet-deposit')}>
              <Feather name="plus-circle" size={18} color="#fff" />
              <Text style={styles.depositBtnText}>Nạp tiền vào ví</Text>
            </TouchableOpacity>

            <View style={styles.historyPlaceholder}>
              <Feather name="clock" size={32} color="#D1D5DB" />
              <Text style={styles.historyTitle}>Lịch sử giao dịch</Text>
              <Text style={styles.historyText}>Tính năng đang được phát triển.</Text>
            </View>
          </>
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
  balanceCard: {
    backgroundColor: '#111827', borderRadius: 16, padding: 24, marginBottom: 16,
  },
  balanceLabel: { color: '#9CA3AF', fontSize: 13, marginBottom: 8 },
  balanceValue: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  depositBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00A67E', borderRadius: 12, paddingVertical: 16, marginBottom: 20
  },
  depositBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  historyPlaceholder: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, padding: 32,
    borderWidth: 1, borderColor: '#E5E7EB'
  },
  historyTitle: { fontSize: 15, fontWeight: 'bold', color: '#374151' },
  historyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#FECACA'
  },
  errorText: { color: '#E02424', fontSize: 13, flex: 1 },
});
