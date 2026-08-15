import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert, Platform } from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import { getPriceUnitText } from '../../utils/formatPriceUnit';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

const getPicUrl = (pic: any): string | null => {
  if (!pic) return null;
  if (typeof pic === 'string') return pic;
  return pic.imageUrl || pic.url || null;
};

export default function MyListingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [listings, setListings] = useState<any[]>([]);
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
        fetchListings();
      }
    }, [token, currentUserId])
  );

  const fetchListings = async () => {
    setIsLoading(true);
    try {
      // STEP 1: Fetch user's own spaces (like web OwnerListings.tsx)
      const spaceRes = await fetch(
        `${API_BASE}/api/Space/GetAll?OwnerId=${encodeURIComponent(currentUserId!)}`,
        { headers: { Authorization: `Bearer ${token}`, accept: '*/*' } }
      );
      let mySpaceIds: any[] = [];
      let mySpaces: any[] = [];
      if (spaceRes.ok) {
        const spaceData = await spaceRes.json();
        mySpaces = Array.isArray(spaceData) ? spaceData : (spaceData?.data || spaceData?.items || []);
        mySpaceIds = mySpaces.map((s: any) => s.id || s.Id);
      }

      // STEP 2: Fetch all listings
      const res = await fetch(`${API_BASE}/api/Listing/GetAll`, {
        headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
      });
      if (res.ok) {
        const data = await res.json();
        const allListings = Array.isArray(data) ? data : (data?.data || data?.items || []);
        
        const allSpacesAndParts: any[] = [...mySpaces];
        await Promise.all(mySpaces.map(async (s: any) => {
          try {
            const partRes = await fetch(`${API_BASE}/api/SpacePart/GetByParent/${s.id || s.Id}`, { headers: { accept: '*/*' } });
            if (partRes.ok) {
              const partData = await partRes.json();
              const parts = Array.isArray(partData) ? partData : (partData?.items || []);
              parts.forEach((p: any) => {
                allSpacesAndParts.push({ ...p, isSpacePart: true });
                mySpaceIds.push(p.id || p.Id);
              });
            }
          } catch(e) {}
        }));

        // STEP 3: Filter by creator match (same logic as web OwnerListings)
        const myListings = allListings.filter((l: any) => {
          return String(l.ownerId || '') === String(currentUserId) ||
            String(l.creatorId || '') === String(currentUserId) ||
            String(l.createdBy || '') === String(currentUserId);
        }).map((item: any) => {
          const parentSpace = allSpacesAndParts.find((s: any) => (s.id || s.Id) === (item.spaceId || item.SpaceId));
          return {
            ...item,
            area: item.area || parentSpace?.area || null,
            isSpacePart: parentSpace?.isSpacePart || false
          };
        });
        
        setListings(myListings);
      }
    } catch (error) {
      console.error("Lỗi tải danh sách tin đăng:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    if (Platform.OS === 'web') {
      if (window.confirm("Bạn có chắc chắn muốn xóa tin đăng này không? Hành động này không thể hoàn tác.")) {
        executeDelete(id);
      }
    } else {
      Alert.alert(
        "Xác nhận xóa",
        "Bạn có chắc chắn muốn xóa tin đăng này không? Hành động này không thể hoàn tác.",
        [
          { text: "Hủy", style: "cancel" },
          { text: "Xóa", style: "destructive", onPress: () => executeDelete(id) }
        ]
      );
    }
  };

  const executeDelete = async (id: number) => {
    try {
      // Use SoftDelete instead of Delete to avoid foreign key constraint errors
      // if the listing has booking requests or other related data.
      const res = await fetch(`${API_BASE}/api/Listing/SoftDelete/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'accept': '*/*'
        }
      });
      if (res.ok) {
        if (Platform.OS === 'web') {
          alert("Đã xóa tin đăng thành công.");
        } else {
          Alert.alert("Thành công", "Đã xóa tin đăng.");
        }
        fetchListings(); // reload list
      } else {
        const err = await res.text();
        if (Platform.OS === 'web') {
          alert("Lỗi: Không thể xóa tin đăng: " + err);
        } else {
          Alert.alert("Lỗi", "Không thể xóa tin đăng: " + err);
        }
      }
    } catch (e: any) {
      if (Platform.OS === 'web') {
        alert("Lỗi: Đã có lỗi xảy ra khi xóa.");
      } else {
        Alert.alert("Lỗi", "Đã có lỗi xảy ra khi xóa.");
      }
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { flexDirection: 'row' }]}>
      {item.listingPictures && item.listingPictures.length > 0 && getPicUrl(item.listingPictures[0]) ? (
        <Image 
          source={{ uri: getPicUrl(item.listingPictures[0])! }} 
          style={{ width: 100, height: 100, borderRadius: 8, marginRight: 12, backgroundColor: '#1F2937' }} 
          resizeMode="cover"
        />
      ) : (
        <View style={{ width: 100, height: 100, borderRadius: 8, marginRight: 12, backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center' }}>
          <Feather name="image" size={24} color="#6B7280" />
        </View>
      )}
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View>
          <Text style={styles.title} numberOfLines={2}>{item.name || item.title || 'Tin đăng không tên'}</Text>
          <Text style={styles.detail}><Feather name="dollar-sign" size={14} color="#6B7280" /> {item.price?.toLocaleString('vi-VN') || 0} đ{getPriceUnitText(item.priceUnit)}</Text>
          <Text style={styles.detail}><Feather name="clock" size={14} color="#6B7280" /> {item.allowedStartTime} - {item.allowedEndTime}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <View style={[styles.statusBadge, item.status === 'published' ? styles.statusActive : styles.statusDraft, { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8 }]}>
              <Text style={[styles.statusText, item.status === 'published' ? styles.statusActiveText : styles.statusDraftText, { fontSize: 10 }]}>
                {item.status === 'published' ? 'Đang hoạt động' : item.status || 'Bản nháp'}
              </Text>
            </View>
            <View style={[styles.statusBadge, (item.listingType === 'SharedSpace' || item.listingType === 1) ? { backgroundColor: '#DBEAFE' } : { backgroundColor: '#ECFDF5' }, { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8 }]}>
              <Text style={[styles.statusText, (item.listingType === 'SharedSpace' || item.listingType === 1) ? { color: '#1D4ED8' } : { color: '#047857' }, { fontSize: 10 }]}>
                {(item.listingType === 'SharedSpace' || item.listingType === 1) ? 'Theo giờ' : 'Dài hạn'}
              </Text>
            </View>
            {item.isSpacePart && (
              <View style={[styles.statusBadge, { backgroundColor: '#F3E8FF', alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8 }]}>
                <Text style={[styles.statusText, { color: '#7E22CE', fontSize: 10 }]}>Từ MB gốc</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => router.push(`/listing/${item.id || item.Id}`)}>
              <Feather name="eye" size={20} color="#00A67E" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push(`/listing/edit-listing?id=${item.id || item.Id}`)}>
              <Feather name="edit" size={20} color="#00A67E" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id || item.Id)}>
              <Feather name="trash-2" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tin đăng của tôi</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/listing/create-listing')}>
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00A67E" />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.center}>
          <Feather name="list" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Bạn chưa có tin đăng nào</Text>
          <TouchableOpacity
            style={{ marginTop: 16, backgroundColor: '#00A67E', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
            onPress={() => router.push('/listing/create-listing')}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>+ Tạo bài đăng mới</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          renderItem={renderItem}
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
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 16, textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2
  },
  cardInfo: { flex: 1, paddingRight: 12 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  detail: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  cardStatus: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  statusActive: { backgroundColor: '#D1FAE5' },
  statusActiveText: { color: '#059669' },
  statusDraft: { backgroundColor: '#F3F4F6' },
  statusDraftText: { color: '#4B5563' },
});
