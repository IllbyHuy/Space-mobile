import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1556761175-5973dc0f32d7?auto=format&fit=crop&q=80&w=800';

const getPicUrl = (pic: any) => {
  if (!pic) return FALLBACK_IMAGE;
  if (typeof pic === 'string') return pic;
  return pic.imageUrl || pic.url || FALLBACK_IMAGE;
};

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [user, setUser] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        // Fetch User Info
        const userRes = await fetch(`https://flexi-space-capstone-project.onrender.com/api/User/${id}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        }

        // Fetch User's Listings
        const listingRes = await fetch('https://flexi-space-capstone-project.onrender.com/api/Listing/GetAll');
        if (listingRes.ok) {
          const listingData = await listingRes.json();
          const allListings = Array.isArray(listingData) ? listingData : listingData?.data || [];
          const userListings = allListings.filter((l: any) => l.creatorId === id && !l.isDeleted);
          setListings(userListings);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProfile();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 16, color: '#64748B' }}>Không tìm thấy người dùng</Text>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.back()}>
          <Text style={{ color: '#4F46E5', fontWeight: 'bold' }}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hồ sơ người dùng</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id?.toString()}
        ListHeaderComponent={() => (
          <View style={styles.profileSection}>
            <Image 
              source={{ uri: user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.userName || user.fullName || 'U')}&background=random` }} 
              style={styles.avatar} 
            />
            <Text style={styles.name}>{user.fullName || user.userName}</Text>
            <Text style={styles.role}>{user.role || 'Người dùng'}</Text>
            
            <View style={styles.contactInfo}>
              <View style={styles.contactRow}>
                <Feather name="mail" size={16} color="#64748B" />
                <Text style={styles.contactText}>{user.email || 'Đang cập nhật'}</Text>
              </View>
              <View style={styles.contactRow}>
                <Feather name="phone" size={16} color="#64748B" />
                <Text style={styles.contactText}>{user.phoneNumber || 'Đang cập nhật'}</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.chatButton}
              onPress={() => router.push({ pathname: '/chat', params: { conversationId: user.id } })}
            >
              <Feather name="message-square" size={16} color="#fff" />
              <Text style={styles.chatButtonText}>Nhắn tin</Text>
            </TouchableOpacity>
            
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Tin đăng đang hoạt động ({listings.length})</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Feather name="inbox" size={40} color="#CBD5E1" />
            <Text style={{ marginTop: 12, color: '#64748B' }}>Chưa có tin đăng nào</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const firstPic = item.listingPictures && item.listingPictures.length > 0 ? getPicUrl(item.listingPictures[0]) : FALLBACK_IMAGE;

          return (
            <TouchableOpacity 
              style={styles.listingCard}
              onPress={() => router.push(`/listing/${item.id}`)}
            >
              <Image source={{ uri: firstPic }} style={styles.listingImage} />
              <View style={styles.listingContent}>
                <Text style={styles.listingTitle} numberOfLines={2}>{item.title || item.name}</Text>
                <Text style={styles.listingPrice}>{item.price ? `${item.price.toLocaleString()} VND / Giờ` : 'Liên hệ'}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D1117',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  profileSection: {
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#E2E8F0',
  },
  name: { fontSize: 22, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  role: { fontSize: 14, color: '#4F46E5', fontWeight: '600', marginBottom: 16 },
  contactInfo: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#334155',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  chatButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    width: '100%',
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  listingCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  listingImage: {
    width: '100%',
    height: 160,
  },
  listingContent: {
    padding: 16,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#10B981',
  },
});
