import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomNavBar } from "@/components/BottomNavBar";
import { FeedListings } from "@/components/FeedListings";
import { HomeSearchBar } from "@/components/HomeSearchBar";
import { useNotificationContext } from "@/hooks/NotificationContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";

export type ListingTypeFilter = 'all' | 'shared' | 'longterm';
export type PriceSortFilter = 'none' | 'asc' | 'desc';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [listingTypeFilter, setListingTypeFilter] = useState<ListingTypeFilter>('all');
  const [priceSortFilter, setPriceSortFilter] = useState<PriceSortFilter>('none');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const { unreadCount, setUnreadCount } = useNotificationContext();

  React.useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const token = await AsyncStorage.getItem("portal_token");
        if (!token) return;
        const res = await fetch("https://flexi-space-capstone-project.onrender.com/api/Notification/unread-count", {
          headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
        });
        if (res.ok) {
          const count = await res.json();
          if (typeof count === 'number') {
            setUnreadCount(count);
          }
        }
      } catch (e) {
        console.error("Error fetching unread count on home:", e);
      }
    };
    fetchUnreadCount();
  }, []);

  const router = useRouter();

  const headerHeight = 60;

  const clampedScrollY = scrollY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolateLeft: "clamp",
  });

  const scrollYClamped = Animated.diffClamp(clampedScrollY, 0, headerHeight);

  const headerTranslateY = scrollYClamped.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight - insets.top],
  });

  const bottomBarTranslateY = scrollYClamped.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, headerHeight + insets.bottom],
  });

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

  const isAnyFilterActive = showFavoritesOnly || listingTypeFilter !== 'all' || priceSortFilter !== 'none';

  const handleResetFilters = () => {
    setShowFavoritesOnly(false);
    setListingTypeFilter('all');
    setPriceSortFilter('none');
  };

  return (
    <View style={styles.container}>
      {/* 1. FEED NẰM DƯỚI CÙNG */}
      <FeedListings
        onScroll={handleScroll}
        headerPadding={headerHeight + insets.top}
        searchQuery={searchQuery}
        showFavoritesOnly={showFavoritesOnly}
        listingTypeFilter={listingTypeFilter}
        priceSortFilter={priceSortFilter}
      />

      {/* 2. HEADER NỔI ĐÈ LÊN TRÊN FEED */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            paddingTop: insets.top,
            height: headerHeight + insets.top,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <HomeSearchBar
          value={searchQuery}
          onChangeValue={setSearchQuery}
          onPressMap={() => router.push("/map")}
          onPressFilter={() => setShowFilterModal(true)}
          isFilterActive={isAnyFilterActive}
          notificationCount={unreadCount} 
          onPressNotification={() => {
            setUnreadCount(0);
            router.push("/notifications");
          }} 
        />
      </Animated.View>

      {/* 3. BOTTOM BAR */}
      <BottomNavBar
        active="home"
        style={{
          paddingBottom: insets.bottom,
          height: 60 + insets.bottom,
          transform: [{ translateY: bottomBarTranslateY }],
        }}
      />

      {/* 4. FILTER MODAL */}
      <Modal visible={showFilterModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bộ lọc</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Feather name="x" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Loại hình */}
              <Text style={styles.filterLabel}>Loại hình</Text>
              <View style={styles.filterRow}>
                {([
                  { val: 'all', label: 'Tất cả' },
                  { val: 'shared', label: 'Chia sẻ chỗ' },
                  { val: 'longterm', label: 'Thuê dài hạn' },
                ] as { val: ListingTypeFilter; label: string }[]).map(opt => (
                  <TouchableOpacity
                    key={opt.val}
                    style={[styles.filterChip, listingTypeFilter === opt.val && styles.filterChipActive]}
                    onPress={() => setListingTypeFilter(opt.val)}
                  >
                    <Text style={[styles.filterChipText, listingTypeFilter === opt.val && styles.filterChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sắp xếp giá */}
              <Text style={styles.filterLabel}>Sắp xếp theo giá</Text>
              <View style={styles.filterRow}>
                {([
                  { val: 'none', label: 'Mặc định' },
                  { val: 'asc', label: '↑ Thấp → Cao' },
                  { val: 'desc', label: '↓ Cao → Thấp' },
                ] as { val: PriceSortFilter; label: string }[]).map(opt => (
                  <TouchableOpacity
                    key={opt.val}
                    style={[styles.filterChip, priceSortFilter === opt.val && styles.filterChipActive]}
                    onPress={() => setPriceSortFilter(opt.val)}
                  >
                    <Text style={[styles.filterChipText, priceSortFilter === opt.val && styles.filterChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Yêu thích */}
              <Text style={styles.filterLabel}>Danh sách yêu thích</Text>
              <TouchableOpacity
                style={[styles.filterChip, showFavoritesOnly && styles.filterChipActive]}
                onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
              >
                <Feather name="heart" size={14} color={showFavoritesOnly ? '#fff' : '#374151'} />
                <Text style={[styles.filterChipText, { marginLeft: 6 }, showFavoritesOnly && styles.filterChipTextActive]}>
                  Chỉ hiện mặt bằng đã lưu
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.resetBtn} onPress={handleResetFilters}>
                <Text style={styles.resetBtnText}>Đặt lại</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilterModal(false)}>
                <Text style={styles.applyBtnText}>Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#CED0D4",
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "#0D1117",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#0D1117",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10, marginTop: 16 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  filterChipActive: { backgroundColor: '#00A67E', borderColor: '#00A67E' },
  filterChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  resetBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center',
  },
  resetBtnText: { color: '#374151', fontWeight: '600' },
  applyBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#00A67E', alignItems: 'center',
  },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

