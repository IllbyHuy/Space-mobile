import React, { useRef, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeSearchBar } from '@/components/HomeSearchBar';
import { FeedListings } from '@/components/FeedListings';
import { BottomNavBar } from '@/components/BottomNavBar';

export default function HomeScreen() {
  const insets = useSafeAreaInsets(); // Lấy chiều cao tai thỏ và dải vuốt đáy
  const scrollY = useRef(new Animated.Value(0)).current;
  const [searchQuery, setSearchQuery] = useState('');

  const headerHeight = 60; // Chiều cao thanh search (không tính phần tai thỏ)
  
  // Tuyệt chiêu chống khựng: Chặn giá trị âm khi người dùng vuốt "lố" lên trên cùng (hiệu ứng bounce)
  const clampedScrollY = scrollY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolateLeft: 'clamp',
  });

  // diffClamp giúp giới hạn khoảng trượt vừa đúng bằng chiều cao Header
  const scrollYClamped = Animated.diffClamp(clampedScrollY, 0, headerHeight);

  // Đẩy Header lên trên (ẩn đi cả phần tai thỏ)
  const headerTranslateY = scrollYClamped.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight - insets.top], 
  });

  // Kéo Bottom Bar xuống đáy
  const bottomBarTranslateY = scrollYClamped.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, headerHeight + insets.bottom],
  });

  // Lắng nghe sự kiện scroll trực tiếp trên phần cứng (Native) giúp mượt tuyệt đối
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  return (
    <View style={styles.container}>
      
      {/* 1. FEED NẰM DƯỚI CÙNG (Tràn full màn hình) */}
      <FeedListings
        onScroll={handleScroll}
        // Đẩy content đầu tiên xuống để không bị Header che mất
        headerPadding={headerHeight + insets.top}
        searchQuery={searchQuery}
      />

      {/* 2. HEADER NỔI ĐÈ LÊN TRÊN FEED */}
      <Animated.View style={[
        styles.headerContainer, 
        { 
          paddingTop: insets.top, // Chừa chỗ tai thỏ
          height: headerHeight + insets.top,
          transform: [{ translateY: headerTranslateY }] 
        }
      ]}>
        <HomeSearchBar value={searchQuery} onChangeValue={setSearchQuery} />
      </Animated.View>

      {/* 3. BOTTOM BAR NỔI ĐÈ LÊN TRÊN FEED */}
      <BottomNavBar
        active="home"
        style={{
          paddingBottom: insets.bottom, // Chừa chỗ dải home ảo của đt
          height: 60 + insets.bottom,
          transform: [{ translateY: bottomBarTranslateY }]
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#CED0D4' // Trùng màu nền xám của Feed để không lộ vệt trắng
  },
  headerContainer: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
});