import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotificationContext } from '@/hooks/NotificationContext';
type NotificationItem = {
  id: number;
  userId: string;
  title: string;
  content: string;
  isRead: boolean;
  type: string;
  referenceId: string | null;
  createdAt: string;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { latestNotification, setUnreadCount } = useNotificationContext();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('portal_token');
      if (!accessToken) {
        setError('Vui lòng đăng nhập để xem thông báo');
        setLoading(false);
        return;
      }

      const response = await fetch('https://flexi-space-capstone-project.onrender.com/api/Notification/history', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': '*/*'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      // Sort by newest first
      const sortedData = Array.isArray(data) 
        ? data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : [];
        
      setNotifications(sortedData);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError('Không thể tải thông báo. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (latestNotification) {
      setNotifications((prev) => {
        // Prevent duplicate by checking if we recently added it (SignalR might fire multiple times or we already fetched it)
        const exists = prev.find(n => n.title === latestNotification.title && n.content === (latestNotification.message || latestNotification.content));
        if (exists) return prev;
        
        const newNotif: NotificationItem = {
          id: Date.now(),
          userId: '',
          title: latestNotification.title || 'Thông báo mới',
          content: latestNotification.message || latestNotification.content || '',
          isRead: false,
          type: latestNotification.type || 'System',
          referenceId: null,
          createdAt: new Date().toISOString(),
        };
        return [newNotif, ...prev];
      });
    }
  }, [latestNotification]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, []);

  const handleNotificationPress = (item: NotificationItem) => {
    // Navigate based on type if needed
    if (item.type === 'Booking' && item.referenceId) {
      router.push(`/contract/${item.referenceId}` as any);
    }
    // Implement mark as read API here if backend supports it
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity 
      style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.iconContainer}>
        <Feather 
          name={item.type === 'Booking' ? 'calendar' : 'bell'} 
          size={24} 
          color={item.isRead ? '#9CA3AF' : '#00A67E'} 
        />
      </View>
      <View style={styles.contentContainer}>
        <Text style={[styles.title, !item.isRead && styles.unreadText]}>{item.title}</Text>
        <Text style={styles.content} numberOfLines={2}>{item.content}</Text>
        <Text style={styles.time}>{formatDate(item.createdAt)}</Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00D4A0" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Feather name="alert-circle" size={48} color="#EF4444" style={{ marginBottom: 16 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchNotifications}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <Feather name="bell-off" size={48} color="#9CA3AF" style={{ marginBottom: 16 }} />
          <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00A67E" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0D1117',
    borderBottomWidth: 1,
    borderBottomColor: '#0D1117',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'flex-start',
  },
  unreadCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  unreadText: {
    color: '#065F46',
    fontWeight: '700',
  },
  content: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00D4A0',
    marginTop: 6,
    marginLeft: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#00A67E',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  }
});
