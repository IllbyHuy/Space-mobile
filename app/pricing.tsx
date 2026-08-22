import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PriorityLevel {
  id: number;
  price: number;
  isActive: boolean;
  name: string;
  description?: string | null;
  durationInDays?: number | null;
  durationForBanner?: number | null;
  type?: string | null;
}

export default function PricingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'all' | 'listing' | 'banner'>('all');
  const [listingLevels, setListingLevels] = useState<PriorityLevel[]>([]);
  const [bannerLevels, setBannerLevels] = useState<PriorityLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLevels = async () => {
      setIsLoading(true);
      try {
        const [listingRes, bannerRes] = await Promise.all([
        const res = await fetch('https://flexi-space-capstone-project.onrender.com/api/PriorityLevel/GetAll', {
          headers: { 'accept': '*/*' }
        });

        if (res.ok) {
          const data = await res.json();
          const safeData: PriorityLevel[] = Array.isArray(data) ? data : (data?.data || data?.items || []);
          const active = safeData.filter(p => p.isActive);
          const normalize = (t?: string | null) => String(t || '').toLowerCase() === 'banner' ? 'Banner' : 'Listing';
          setListingLevels(active.filter(p => normalize(p.type) === 'Listing').sort((a, b) => a.id - b.id));
          setBannerLevels(active.filter(p => normalize(p.type) === 'Banner').sort((a, b) => a.id - b.id));
        }
      } catch (err) {
        console.error('Lỗi khi tải gói dịch vụ:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadLevels();
  }, []);

  const handleActionClick = async () => {
    const token = await AsyncStorage.getItem('portal_token');
    if (token) {
      router.push('/manage-spaces'); // Thay the '/user/listings' cua web
    } else {
      router.push('/login');
    }
  };

  const filteredListingLevels = activeTab === 'banner' ? [] : listingLevels;
  const filteredBannerLevels = activeTab === 'listing' ? [] : bannerLevels;

  const renderCard = (pkg: PriorityLevel, type: 'listing' | 'banner') => (
    <View key={`${type}-${pkg.id}`} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: type === 'listing' ? '#DBEAFE' : '#FEF3C7' }]}>
          <Feather name={type === 'listing' ? 'zap' : 'megaphone'} size={24} color={type === 'listing' ? '#2563EB' : '#D97706'} />
        </View>
        <Text style={styles.cardTitle}>{pkg.name}</Text>
      </View>
      <View style={styles.priceContainer}>
        <Text style={styles.priceValue}>{(pkg.price ?? 0).toLocaleString('vi-VN')}</Text>
        <Text style={styles.priceUnit}>VND / gói</Text>
      </View>
      <Text style={styles.description}>{pkg.description || 'Không có mô tả chi tiết'}</Text>
      <View style={styles.benefits}>
        <View style={styles.benefitRow}>
          <Feather name="check-circle" size={16} color="#10B981" />
          <Text style={styles.benefitText}>
            Thời hạn: <Text style={{ fontWeight: 'bold' }}>
              {type === 'listing' ? (pkg.durationInDays ?? 0) : (pkg.durationForBanner ?? 0)} ngày
            </Text>
          </Text>
        </View>
        <View style={styles.benefitRow}>
          <Feather name="check-circle" size={16} color="#10B981" />
          <Text style={styles.benefitText}>{type === 'listing' ? 'Hiển thị cao trên kết quả tìm kiếm' : 'Hiển thị trên Banner trang chủ'}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.actionBtn} onPress={handleActionClick}>
        <Text style={styles.actionBtnText}>Dùng thử ngay</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bảng Giá Dịch Vụ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={styles.heroBadge}>
            <Feather name="star" size={14} color="#2563EB" />
            <Text style={styles.heroBadgeText}>Gói Bài Đăng & Banner Quảng Cáo</Text>
          </View>
          <Text style={styles.heroTitle}>Tối ưu hoá khả năng tiếp cận</Text>
          <Text style={styles.heroSubtitle}>
            Tăng lượt xem, tiếp cận nhanh chóng khách hàng tiềm năng với các gói hiển thị ưu tiên và banner.
          </Text>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>Tất Cả</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'listing' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('listing')}
          >
            <Text style={[styles.tabText, activeTab === 'listing' && styles.tabTextActive]}>Bài Đăng</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'banner' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('banner')}
          >
            <Text style={[styles.tabText, activeTab === 'banner' && styles.tabTextActive]}>Banner</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00d4a0" />
            <Text style={styles.loadingText}>Đang tải thông tin các gói...</Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {filteredListingLevels.length === 0 && filteredBannerLevels.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="box" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>Chưa có gói dịch vụ nào trong mục này.</Text>
              </View>
            ) : (
              <>
                {filteredListingLevels.map(pkg => renderCard(pkg, 'listing'))}
                {filteredBannerLevels.map(pkg => renderCard(pkg, 'banner'))}
              </>
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D1117',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  heroSection: {
    padding: 24,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  heroBadgeText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  tabsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabBtnActive: {
    backgroundColor: '#0D1117',
    borderColor: '#0D1117',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  tabTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },
  gridContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  priceUnit: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
    marginLeft: 4,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 20,
  },
  benefits: {
    gap: 12,
    marginBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  actionBtn: {
    backgroundColor: '#0D1117',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#00d4a0',
    fontSize: 16,
    fontWeight: '700',
  },
});
