import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'; // THÊM Stack VÀO ĐÂY
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1556761175-5973dc0f32d7?auto=format&fit=crop&q=80&w=800';

// Logic ánh xạ ngày và giờ (bê từ Web sang)
const DAY_LABELS: Record<number, string> = {
  0: 'Chủ Nhật', 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7',
};
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const formatTime = (t: string) => (t ? t.substring(0, 5) : '');

const getPicUrl = (pic: any) => {
  if (!pic) return FALLBACK_IMAGE;
  if (typeof pic === 'string') return pic;
  return pic.imageUrl || pic.url || FALLBACK_IMAGE;
};

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [listing, setListing] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const [spaceRes, listingRes] = await Promise.all([
          fetch('https://flexi-space-capstone-project.onrender.com/api/Space/GetAll', { headers: { accept: '*/*' } }),
          fetch('https://flexi-space-capstone-project.onrender.com/api/Listing/GetAll', { headers: { accept: '*/*' } })
        ]);

        let spaces: any[] = [];
        if (spaceRes.ok) spaces = await spaceRes.json();
        
        if (listingRes.ok) {
          const listingData = await listingRes.json();
          const safeData = Array.isArray(listingData) ? listingData : (listingData?.data || listingData?.items || []);
          
          const found = safeData.find((item: any) => (item.id?.toString() === id || item.Id?.toString() === id));

          if (found) {
            const parentSpace = spaces.find((s: any) => (s.id || s.Id) === (found.spaceId || found.SpaceId));
            setListing({
              ...found,
              area: found.area || parentSpace?.area || null,
              address: found.location || found.address || parentSpace?.address || parentSpace?.location || '',
              amenities: found.amenities || parentSpace?.amenities || [],
              operatingHours: found.operatingHours || parentSpace?.operatingHours || [],
              allowedCategories: found.spaceAllowedCategories || parentSpace?.spaceAllowedCategories || []
            });
          }
        }
      } catch (error) {
        console.error("Lỗi tải chi tiết:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchDetail();
  }, [id]);

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: '#fff' }]}>
        {/* TẮT HEADER MẶC ĐỊNH LÚC ĐANG LOADING */}
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#00A67E" />
      </View>
    );
  }

  if (!listing) return null;

  const rawPictures = listing.listingPictures || [];
  const mainImage = rawPictures.length > 0 ? getPicUrl(rawPictures[0]) : FALLBACK_IMAGE;
  const isHourly = (listing.listingType === 'SharedSpace' || listing.isHourly === true);

  const activeAmenities = listing.amenities?.filter((a: any) => a.isActive !== false) || [];
  const operatingHours = listing.operatingHours || [];
  const allowedCategories = listing.allowedCategories || [];

  return (
    <View style={styles.container}>
      {/* ĐÂY LÀ ĐIỂM MẤU CHỐT: Tắt thanh tiêu đề mặc định của Expo Router */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* NÚT BACK OVERLAY (Sẽ nằm chìm lên trên bức ảnh tràn viền) */}
      <TouchableOpacity 
        style={[styles.backBtn, { top: Math.max(insets.top, 20) + 10 }]} 
        onPress={() => router.back()}
      >
        <Feather name="chevron-left" size={24} color="#111827" />
      </TouchableOpacity>
      
      {/* NÚT SHARE/SAVE OVERLAY */}
      <View style={[styles.topRightActions, { top: Math.max(insets.top, 20) + 10 }]}>
        <TouchableOpacity style={styles.iconBtnOverlay}>
          <Feather name="share" size={20} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtnOverlay}>
          <Feather name="heart" size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* 1. ẢNH BÌA TRÀN VIỀN LÊN TẬN MÉP TRÊN */}
        <Image source={{ uri: mainImage }} style={styles.coverImage} />

        <View style={styles.contentBody}>
          {/* 2. HEADER THÔNG TIN */}
          <View style={styles.titleSection}>
            <View style={styles.tagWrap}>
               <Text style={styles.tagText}>{isHourly ? 'Share theo giờ' : 'Thuê dài hạn'}</Text>
            </View>
            <Text style={styles.title}>{listing.name || 'Mặt bằng cho thuê'}</Text>
            <Text style={styles.location}>
              <Feather name="map-pin" size={14} color="#6B7280" /> {listing.address}
            </Text>
          </View>

          {/* 3. THÔNG SỐ CHÍNH */}
          <View style={styles.specsRow}>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>Mức giá</Text>
              <Text style={styles.specValue}>{listing.price ? `${listing.price.toLocaleString('vi-VN')} đ` : 'Thỏa thuận'}</Text>
            </View>
            <View style={styles.specDivider} />
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>Diện tích</Text>
              <Text style={styles.specValue}>{listing.area ? `${listing.area} m²` : 'N/A'}</Text>
            </View>
          </View>

          {/* 4. CHỦ NHÀ */}
          <View style={styles.hostSection}>
            <View style={styles.hostAvatar}>
              <Text style={styles.hostAvatarText}>{(listing.lessorName || 'CH').substring(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hostName}>Chủ nhà {listing.lessorName || 'Ẩn danh'}</Text>
              <Text style={styles.hostStatus}>Đang hoạt động</Text>
            </View>
            <TouchableOpacity style={styles.chatIconBtn}>
               <Feather name="message-circle" size={20} color="#00A67E" />
            </TouchableOpacity>
          </View>

          {/* 5. MÔ TẢ */}
          <View style={styles.descSection}>
            <Text style={styles.sectionTitle}>Thông tin mô tả</Text>
            <Text style={styles.description}>
              {listing.description || 'Chủ nhà chưa cung cấp mô tả chi tiết cho mặt bằng này.'}
            </Text>
          </View>

          {/* 6. TIỆN ÍCH */}
          {activeAmenities.length > 0 && (
            <View style={styles.descSection}>
              <Text style={styles.sectionTitle}>Tiện ích</Text>
              <View style={styles.amenitiesWrap}>
                {activeAmenities.map((a: any, idx: number) => (
                  <View key={idx} style={styles.amenityBadge}>
                    <Feather name="check" size={14} color="#00A67E" />
                    <Text style={styles.amenityText}>{a.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 7. MỤC ĐÍCH SỬ DỤNG */}
          {allowedCategories.length > 0 && (
            <View style={styles.descSection}>
              <Text style={styles.sectionTitle}>Phù hợp kinh doanh</Text>
              <View style={styles.amenitiesWrap}>
                {allowedCategories.map((cat: any, idx: number) => {
                  const label = typeof cat === 'string' ? cat : (cat.name || cat.categoryName || cat.title || '');
                  return (
                    <View key={idx} style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* 8. GIỜ HOẠT ĐỘNG */}
          {operatingHours.length > 0 && (
            <View style={styles.descSection}>
              <Text style={styles.sectionTitle}>Giờ hoạt động</Text>
              <View style={styles.hoursBox}>
                {DAY_ORDER.map((day, idx) => {
                  const entry = operatingHours.find((h: any) => h.dayOfWeek === day);
                  return (
                    <View key={day} style={[styles.hourRow, idx === DAY_ORDER.length - 1 && { borderBottomWidth: 0 }]}>
                      <Text style={styles.hourDay}>{DAY_LABELS[day]}</Text>
                      {entry ? (
                        <Text style={styles.hourTime}>{formatTime(entry.openTime)} - {formatTime(entry.closeTime)}</Text>
                      ) : (
                        <Text style={styles.hourClosed}>Đóng cửa</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* 9. MÔ PHỎNG BẢN ĐỒ */}
          <View style={styles.descSection}>
            <Text style={styles.sectionTitle}>Vị trí</Text>
            <View style={styles.mapMockup}>
              <Feather name="map" size={32} color="#9CA3AF" style={{ marginBottom: 8 }}/>
              <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center' }}>
                Tính năng bản đồ đang được hoàn thiện. Vị trí ước tính tại:
              </Text>
              <Text style={{ color: '#111827', fontSize: 14, fontWeight: 'bold', marginTop: 4, textAlign: 'center' }}>
                {listing.address}
              </Text>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* STICKY BOTTOM BAR */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bottomPrice}>
            {listing.price ? `${listing.price.toLocaleString('vi-VN')} đ` : 'Thỏa thuận'}
            <Text style={styles.bottomUnit}>{isHourly ? '/giờ' : '/tháng'}</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.bookBtn}>
          <Text style={styles.bookBtnText}>Gửi yêu cầu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    position: 'absolute', left: 16, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, elevation: 4,
  },
  topRightActions: {
    position: 'absolute', right: 16, zIndex: 10,
    flexDirection: 'row', gap: 10
  },
  iconBtnOverlay: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, elevation: 4,
  },
  coverImage: { width: width, height: 320, resizeMode: 'cover' },
  contentBody: { padding: 20 },
  titleSection: { marginBottom: 24 },
  tagWrap: { alignSelf: 'flex-start', backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  tagText: { color: '#047857', fontSize: 12, fontWeight: 'bold' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 8, lineHeight: 30 },
  location: { fontSize: 14, color: '#6B7280' },
  specsRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6', paddingVertical: 16, marginBottom: 24 },
  specBox: { flex: 1, alignItems: 'center' },
  specDivider: { width: 1, backgroundColor: '#F3F4F6' },
  specLabel: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  specValue: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  hostSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, marginBottom: 24 },
  hostAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#00A67E', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  hostAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  hostName: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 2 },
  hostStatus: { fontSize: 13, color: '#10B981' },
  chatIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, elevation: 2 },
  descSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  description: { fontSize: 15, lineHeight: 24, color: '#4B5563' },
  amenitiesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  amenityText: { fontSize: 14, color: '#374151' },
  categoryBadge: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#EEF2F7', borderRadius: 20 },
  categoryText: { fontSize: 13, color: '#1E293B', fontWeight: '500' },
  hoursBox: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 12, overflow: 'hidden' },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  hourDay: { fontSize: 14, color: '#374151', fontWeight: '500' },
  hourTime: { fontSize: 14, color: '#10B981', fontWeight: '600' },
  hourClosed: { fontSize: 14, color: '#9CA3AF' },
  mapMockup: { height: 180, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  bottomPrice: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  bottomUnit: { fontSize: 14, color: '#6B7280', fontWeight: 'normal' },
  bookBtn: { backgroundColor: '#111827', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8 },
  bookBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});