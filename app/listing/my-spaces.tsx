import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

export default function MySpacesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [spaces, setSpaces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadAuth = async () => {
      const tk = await AsyncStorage.getItem('portal_token');
      const uid = await AsyncStorage.getItem('current_user_id');
      setToken(tk);
      setCurrentUserId(uid);
    };
    loadAuth();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (token && currentUserId) {
        fetchSpaces();
      }
    }, [token, currentUserId])
  );

  const fetchSpaces = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/Space/GetAll?OwnerId=${currentUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSpaces(Array.isArray(data) ? data : (data?.data || data?.items || []));
      }
    } catch (error) {
      console.error("Lỗi tải danh sách mặt bằng:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa mặt bằng này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            const targetId = item.id || item.Id;
            const res = await fetch(`${API_BASE}/api/Space/Delete${targetId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              setSpaces(prev => prev.filter(s => (s.id || s.Id) !== targetId));
              Alert.alert('Thành công', 'Đã xóa mặt bằng.');
            } else {
              Alert.alert('Lỗi', 'Không thể xóa mặt bằng.');
            }
          } catch (error) {
            console.error('Delete Space error', error);
          }
        }
      }
    ]);
  };

  const SpaceCard = ({ item }: { item: any }) => {
    const [expanded, setExpanded] = useState(false);
    
    return (
      <TouchableOpacity style={styles.card} onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={styles.cardInfo}>
            <Text style={styles.spaceTitle}>{item.name}</Text>
            <Text style={styles.spaceDetail}><Feather name="map-pin" size={14} color="#6B7280" /> {item.address || 'Đang cập nhật địa chỉ'}</Text>
            <Text style={styles.spaceDetail}><Feather name="maximize" size={14} color="#6B7280" /> {item.area || item.acreage || 0} m²</Text>
          </View>
          <View style={styles.cardStatus}>
            <View style={[styles.statusBadge, item.status === 'Available' ? styles.statusAvailable : styles.statusPending]}>
              <Text style={[styles.statusText, item.status === 'Available' ? styles.statusAvailableText : styles.statusPendingText]}>
                {item.status === 'Available' ? 'Trống' : item.status || 'Đang xử lý'}
              </Text>
            </View>
            <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" style={{ marginTop: 8 }} />
          </View>
        </View>
        {expanded && (
          <View style={styles.expandedContent}>
            <Text style={styles.expandedLabel}>Tiện ích:</Text>
            <Text style={styles.expandedText}>
              {item.amenities && item.amenities.length > 0 
                ? item.amenities.map((a: any) => a.name).join(', ') 
                : 'Không có thông tin'}
            </Text>
            <Text style={styles.expandedLabel}>Giờ hoạt động:</Text>
            <Text style={styles.expandedText}>
              {item.operatingHours && item.operatingHours.length > 0
                ? `${item.operatingHours.length} ngày trong tuần`
                : 'Không có thông tin'}
            </Text>

            <View style={styles.actionsRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#F3F4F6' }]}
                onPress={() => router.push({
                  pathname: '/listing/create-space',
                  params: { id: item.id || item.Id }
                })}
              >
                <Feather name="edit" size={16} color="#4B5563" />
                <Text style={{ color: '#4B5563', fontWeight: '500', marginLeft: 4 }}>Sửa</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
                onPress={() => handleDelete(item)}
              >
                <Feather name="trash-2" size={16} color="#DC2626" />
                <Text style={{ color: '#DC2626', fontWeight: '500', marginLeft: 4 }}>Xóa</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#E0F2FE', marginTop: 12, width: '100%' }]}
              onPress={() => {
                const spaceOwnerId = String(item.ownerId || item.OwnerId || '');
                if (spaceOwnerId && currentUserId !== spaceOwnerId) {
                  Alert.alert('Lỗi', 'Bạn không có quyền chia nhỏ space được lấy từ người chủ');
                  return;
                }
                router.push({
                  pathname: '/listing/space-parts',
                  params: { parentSpaceId: item.id || item.Id, parentSpaceName: item.name }
                })
              }}
            >
              <Feather name="grid" size={16} color="#0369A1" />
              <Text style={{ color: '#0369A1', fontWeight: 'bold', marginLeft: 6 }}>Quản lý không gian chia nhỏ</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mặt bằng của tôi</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/listing/create-space')}>
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00A67E" />
        </View>
      ) : spaces.length === 0 ? (
        <View style={styles.center}>
          <Feather name="layout" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Bạn chưa có mặt bằng nào</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/listing/create-space')}>
            <Text style={styles.createBtnText}>Tạo mặt bằng mới</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={spaces}
          keyExtractor={(item) => String(item.id || item.Id)}
          renderItem={({ item }) => <SpaceCard item={item} />}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
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
  addBtn: { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 16, marginBottom: 24, textAlign: 'center' },
  createBtn: { backgroundColor: '#00A67E', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  createBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2
  },
  cardInfo: { flex: 1, paddingRight: 12 },
  spaceTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  spaceDetail: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  cardStatus: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  statusAvailable: { backgroundColor: '#D1FAE5' },
  statusAvailableText: { color: '#059669' },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusPendingText: { color: '#D97706' },
  expandedContent: {
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6'
  },
  expandedLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#374151' },
  expandedText: { fontSize: 13, color: '#4B5563', marginBottom: 12 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 8
  },
});
