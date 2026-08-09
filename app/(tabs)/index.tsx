import { useRouter } from "expo-router"; // 1. IMPORT THÊM ROUTER
import React, { useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomNavBar } from "@/components/BottomNavBar";
import { FeedListings } from "@/components/FeedListings";
import { HomeSearchBar } from "@/components/HomeSearchBar";
import { useNotificationContext } from "@/hooks/NotificationContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
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

  const router = useRouter(); // 2. KHỞI TẠO ROUTER

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

  return (
    <View style={styles.container}>
      {/* 1. FEED NẰM DƯỚI CÙNG */}
      <FeedListings
        onScroll={handleScroll}
        headerPadding={headerHeight + insets.top}
        searchQuery={searchQuery}
        showFavoritesOnly={showFavoritesOnly}
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
          onPressFilter={() => setShowFavoritesOnly(!showFavoritesOnly)}
          isFilterActive={showFavoritesOnly}
          notificationCount={unreadCount} 
          onPressNotification={() => {
            setUnreadCount(0); // Optional: reset count immediately or let the notifications screen handle it
            router.push("/notifications");
          }} 
        />
      </Animated.View>

      {/* 3. BOTTOM BAR NỔI ĐÈ LÊN TRÊN FEED */}
      <BottomNavBar
        active="home"
        style={{
          paddingBottom: insets.bottom,
          height: 60 + insets.bottom,
          transform: [{ translateY: bottomBarTranslateY }],
        }}
      />
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
});
