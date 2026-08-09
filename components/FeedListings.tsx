import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Share, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800';

const getPicUrl = (pic: any) => {
  if (!pic) return FALLBACK_IMAGE;
  if (typeof pic === 'string') return pic;
  return pic.imageUrl || pic.url || FALLBACK_IMAGE;
};

// Nhận thêm headerPadding để căn lề trên
export const FeedListings = ({ onScroll, headerPadding = 0, searchQuery = '', showFavoritesOnly = false }: { onScroll?: any, headerPadding?: number, searchQuery?: string, showFavoritesOnly?: boolean }) => {
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('portal_token');
        setToken(storedToken);

        const [spaceRes, listingRes] = await Promise.all([
          fetch('https://flexi-space-capstone-project.onrender.com/api/Space/GetAll', { headers: { accept: '*/*' } }),
          fetch('https://flexi-space-capstone-project.onrender.com/api/Listing/GetAll', { headers: { accept: '*/*' } })
        ]);

        let spaces: any[] = [];
        if (spaceRes.ok) spaces = await spaceRes.json();
        
        let allSpacesAndParts: any[] = [...spaces];
        await Promise.all(spaces.map(async (s) => {
          try {
            const partRes = await fetch(`https://flexi-space-capstone-project.onrender.com/api/SpacePart/GetByParent/${s.id || s.Id}`, { headers: { accept: '*/*' } });
            if (partRes.ok) {
              const partData = await partRes.json();
              const parts = Array.isArray(partData) ? partData : (partData?.items || []);
              parts.forEach((p: any) => {
                allSpacesAndParts.push({ ...p, isSpacePart: true });
              });
            }
          } catch(e) {}
        }));

        if (listingRes.ok) {
          const listingData = await listingRes.json();
          let safeData = Array.isArray(listingData) ? listingData : (listingData?.data || listingData?.items || []);

          safeData = safeData.map((item: any) => {
            const parentSpace = allSpacesAndParts.find((s: any) => (s.id || s.Id) === (item.spaceId || item.SpaceId));
            return {
              ...item,
              area: item.area || parentSpace?.area || null,
              address: item.spaceAddress || item.location || item.address || parentSpace?.address || parentSpace?.location || '',
              isSpacePart: parentSpace?.isSpacePart || false
            };
          });

          setListings(safeData.reverse());
        }

        if (storedToken) {
          const favRes = await fetch('https://flexi-space-capstone-project.onrender.com/api/FavoriteList/FavoriteByUser', {
            headers: { Authorization: `Bearer ${storedToken}`, accept: '*/*' }
          });
          if (favRes.ok) {
            const favData = await favRes.json();
            const favArray = Array.isArray(favData) ? favData : (favData?.data || favData?.items || favData?.listingIds || []);
            const ids = favArray.map((item: any) => {
              if (typeof item === 'number' || typeof item === 'string') return item.toString();
              return (item?.listingId || item?.ListingId || item?.listing?.id || item?.id || item?.Id)?.toString();
            }).filter(Boolean);
            setFavoriteIds(new Set(ids));
          }
        }
      } catch (error) {
        console.error('Lỗi tải Feed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFeed();
  }, []);

  const handleToggleFavorite = async (listingId: string | number) => {
    if (!token) {
      Alert.alert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập để lưu mặt bằng!', [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => router.push('/login') }
      ]);
      return;
    }
    const idStr = listingId.toString();
    const isSaved = favoriteIds.has(idStr);
    try {
      if (isSaved) {
        const res = await fetch(`https://flexi-space-capstone-project.onrender.com/api/FavoriteList/listings/${Number(listingId)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
        });
        if (res.ok) {
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(idStr);
            return next;
          });
        }
      } else {
        const res = await fetch('https://flexi-space-capstone-project.onrender.com/api/FavoriteList/listings', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', accept: '*/*' },
          body: JSON.stringify({ listingIds: [Number(listingId)] })
        });
        if (res.ok) {
          setFavoriteIds((prev) => new Set(prev).add(idStr));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareListing = async (item: any) => {
    try {
      await Share.share({
        title: item.name || 'Mặt bằng cho thuê',
        message: `${item.name || 'Mặt bằng cho thuê'} - ${item.address || ''}`
      });
    } catch (err) {
      console.error('Lỗi chia sẻ:', err);
    }
  };

  const renderFacebookStylePost = ({ item }: { item: any }) => {
    const rawPictures = item.listingPictures || [];
    const mainImage = rawPictures.length > 0 ? getPicUrl(rawPictures[0]) : FALLBACK_IMAGE;
    const isHourly = (item.listingType === 'SharedSpace' || item.isHourly === true);
    const itemId = item.id || item.Id;
    const isSaved = favoriteIds.has(itemId?.toString());

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
          <View style={[styles.badgeWrapper, { flexDirection: 'row', gap: 6, backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0 }]}>
            {item.isSpacePart && (
              <View style={[styles.badgeWrapper, { backgroundColor: '#F3E8FF' }]}>
                <Text style={[styles.badgeText, { color: '#7E22CE' }]}>Từ MB gốc</Text>
              </View>
            )}
            <View style={styles.badgeWrapper}>
              <Text style={[styles.badgeText, { color: isHourly ? '#1d4ed8' : '#047857' }]}>
                 {isHourly ? 'Theo giờ' : 'Dài hạn'}
              </Text>
            </View>
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
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggleFavorite(itemId)}>
            <Feather name="heart" size={20} color={isSaved ? '#E02424' : '#65676B'} />
            <Text style={[styles.actionText, isSaved && { color: '#E02424' }]}>{isSaved ? 'Đã lưu' : 'Lưu tin'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => handleShareListing(item)}>
            <Feather name="share-2" size={20} color="#65676B" />
            <Text style={styles.actionText}>Chia sẻ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) return <ActivityIndicator size="large" color="#00A67E" style={{ marginTop: headerPadding + 40 }} />;

  let filteredListings = listings;

  if (showFavoritesOnly) {
    filteredListings = filteredListings.filter((item) => favoriteIds.has((item.id || item.Id)?.toString()));
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (normalizedQuery) {
    filteredListings = filteredListings.filter((item) =>
      (item.name || '').toLowerCase().includes(normalizedQuery) ||
      (item.address || '').toLowerCase().includes(normalizedQuery)
    );
  }

  return (
    <Animated.FlatList
      data={filteredListings}
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