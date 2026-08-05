import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800';

const getPicUrl = (pic: any) => {
  if (!pic) return FALLBACK_IMAGE;
  if (typeof pic === 'string') return pic;
  return pic.imageUrl || pic.url || FALLBACK_IMAGE;
};

// Nhận thêm headerPadding để căn lề trên
export const FeedListings = ({ onScroll, headerPadding = 0 }: { onScroll?: any, headerPadding?: number }) => {
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const [spaceRes, listingRes] = await Promise.all([
          fetch('https://flexi-space-capstone-project.onrender.com/api/Space/GetAll', { headers: { accept: '*/*' } }),
          fetch('https://flexi-space-capstone-project.onrender.com/api/Listing/GetAll', { headers: { accept: '*/*' } })
        ]);

        let spaces: any[] = [];
        if (spaceRes.ok) spaces = await spaceRes.json();
        
        if (listingRes.ok) {
          const listingData = await listingRes.json();
          let safeData = Array.isArray(listingData) ? listingData : (listingData?.data || listingData?.items || []);
          
          safeData = safeData.map((item: any) => {
            const parentSpace = spaces.find((s: any) => (s.id || s.Id) === (item.spaceId || item.SpaceId));
            return {
              ...item,
              area: item.area || parentSpace?.area || null,
              address: item.spaceAddress || item.location || item.address || parentSpace?.address || parentSpace?.location || ''
            };
          });
          
          setListings(safeData.reverse());
        }
      } catch (error) {
        console.error('Lỗi tải Feed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFeed();
  }, []);

  const renderFacebookStylePost = ({ item }: { item: any }) => {
    const rawPictures = item.listingPictures || [];
    const mainImage = rawPictures.length > 0 ? getPicUrl(rawPictures[0]) : FALLBACK_IMAGE;
    const isHourly = (item.listingType === 'SharedSpace' || item.isHourly === true);
    
    return (
      <View style={styles.postContainer}>
        {/* HEADER */}
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.lessorName || 'CH').substring(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.headerTextInfo}>
            <Text style={styles.authorName}>Chủ nhà {item.lessorName || 'Ẩn danh'}</Text>
            <Text style={styles.timeAndLocation}>2 giờ trước • 📍 {item.address?.substring(0, 20) || 'TP.HCM'}</Text>
          </View>
          <View style={styles.badgeWrapper}>
            <Text style={[styles.badgeText, { color: isHourly ? '#1d4ed8' : '#047857' }]}>
               {isHourly ? 'Theo giờ' : 'Dài hạn'}
            </Text>
          </View>
        </View>

        {/* BODY TEXT */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/listing/${item.id || item.Id}`)} style={styles.postBodyText}>
          <Text style={styles.postTitle}>{item.name || 'Mặt bằng cho thuê siêu đẹp'}</Text>
          <Text style={styles.postPriceArea}>
            💰 {item.price ? `${item.price.toLocaleString('vi-VN')} đ` : 'Thỏa thuận'} • {item.area ? `${item.area}m²` : 'N/A'}
          </Text>
        </TouchableOpacity>

        {/* MEDIA */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => router.push(`/listing/${item.id || item.Id}`)}>
          <Image source={{ uri: mainImage }} style={styles.postImage} />
          {rawPictures.length > 1 && (
            <View style={styles.imageCountOverlay}>
              <Text style={{color: '#fff', fontSize: 12, fontWeight: 'bold'}}>+{rawPictures.length - 1}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* FOOTER */}
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionBtn}>
            <Feather name="heart" size={20} color="#65676B" />
            <Text style={styles.actionText}>Lưu tin</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Feather name="message-circle" size={20} color="#65676B" />
            <Text style={styles.actionText}>Nhắn tin</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Feather name="share-2" size={20} color="#65676B" />
            <Text style={styles.actionText}>Chia sẻ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) return <ActivityIndicator size="large" color="#00A67E" style={{ marginTop: headerPadding + 40 }} />;

  return (
    <Animated.FlatList
      data={listings}
      keyExtractor={(item, index) => (item.id || item.Id || index).toString()}
      renderItem={renderFacebookStylePost}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll} 
      // Quyết định độ mượt: 1 = bắt sự kiện mọi khung hình (60 FPS)
      scrollEventThrottle={1} 
      contentContainerStyle={{ 
        paddingTop: headerPadding, // Khoảng trống cho Header đè lên
        paddingBottom: 100, // Khoảng trống cho Bottom Bar đè lên
        backgroundColor: '#CED0D4' 
      }} 
    />
  );
};

const styles = StyleSheet.create({
  postContainer: { backgroundColor: '#fff', marginBottom: 8 },
  postHeader: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00A67E', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  headerTextInfo: { flex: 1 },
  authorName: { fontSize: 15, fontWeight: 'bold', color: '#050505', marginBottom: 2 },
  timeAndLocation: { fontSize: 12, color: '#65676B' },
  badgeWrapper: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  postBodyText: { paddingHorizontal: 12, paddingBottom: 10 },
  postTitle: { fontSize: 15, color: '#050505', marginBottom: 4 },
  postPriceArea: { fontSize: 15, fontWeight: 'bold', color: '#00A67E' },
  postImage: { width: '100%', height: 350, resizeMode: 'cover' },
  imageCountOverlay: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  postActions: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#F0F2F5' },
  actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, gap: 6 },
  actionText: { color: '#65676B', fontSize: 14, fontWeight: '600' }
});