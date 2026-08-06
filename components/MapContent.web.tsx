import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export function MapContent() {
  return (
    <View style={styles.webContainer}>
      <Feather name="map" size={40} color="#9CA3AF" style={{ marginBottom: 16 }} />
      <Text style={styles.webText}>Bản đồ không hỗ trợ hiển thị trên Web</Text>
      <Text style={styles.webSubText}>Vui lòng mở app trên điện thoại (Expo Go) để xem tính năng bản đồ!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 32,
  },
  webText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  webSubText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
});