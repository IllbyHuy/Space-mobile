import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapContent } from '@/components/MapContent';


export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const response = await fetch('https://flexi-space-capstone-project.onrender.com/api/Listing/GetAll', {
          headers: { accept: '*/*' },
        });

        if (response.ok) {
          const data = await response.json();
          const safeData = Array.isArray(data) ? data : data?.data || data?.items || [];

          const processedListings = safeData.map((item: any) => ({
            ...item,
            lat: (item.spaceLatitude && item.spaceLatitude !== 0) ? item.spaceLatitude : 10.7769,
            lng: (item.spaceLongitude && item.spaceLongitude !== 0) ? item.spaceLongitude : 106.7,
          }));

          setListings(processedListings);
        }
      } catch (error) {
        console.error('Lỗi lấy dữ liệu bản đồ:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.backBtn, { top: Math.max(insets.top, 20) + 10 }]}
        onPress={() => router.back()}
      >
        <Feather name="chevron-left" size={24} color="#111827" />
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E03C31" />
          <Text style={styles.loadingText}>Đang tải bản đồ & tọa độ...</Text>
        </View>
      ) : (
        <MapContent listings={listings} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    elevation: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
});