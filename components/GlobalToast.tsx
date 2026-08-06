import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNotificationContext } from '@/hooks/NotificationContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function GlobalToast() {
  const { latestNotification } = useNotificationContext();
  const translateY = useRef(new Animated.Value(-150)).current;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (latestNotification) {
      // Bật Toast xuống
      Animated.spring(translateY, {
        toValue: insets.top > 0 ? insets.top : 20,
        useNativeDriver: true,
        bounciness: 12,
      }).start();

      // Sau 4 giây, tự động thu lên
      const timer = setTimeout(() => {
        hideToast();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [latestNotification, insets.top]);

  const hideToast = () => {
    Animated.timing(translateY, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    hideToast();
    router.push('/notifications');
  };

  if (!latestNotification) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <TouchableOpacity activeOpacity={0.9} style={styles.toast} onPress={handlePress}>
        <View style={styles.iconContainer}>
          <Feather name="bell" size={20} color="#fff" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {latestNotification.title || 'Thông báo mới'}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {latestNotification.message || latestNotification.content || ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={hideToast}>
          <Feather name="x" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 999999, // Cực cao để nổi lên mọi màn hình
  },
  toast: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#00D4A0',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00D4A0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#111827',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: '#4B5563',
  },
  closeBtn: {
    padding: 8,
  }
});
