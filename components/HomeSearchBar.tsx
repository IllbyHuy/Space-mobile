import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';

type HomeSearchBarProps = {
  value?: string;
  onChangeValue?: (text: string) => void;
  onPressMap?: () => void; 
  onPressNotification?: () => void; 
  onPressFilter?: () => void; // Thêm lại prop cho Filter
  notificationCount?: number; 
};

export const HomeSearchBar = ({ value, onChangeValue, onPressMap, onPressNotification, onPressFilter, notificationCount = 0 }: HomeSearchBarProps) => {
  return (
    <View style={styles.container}>
      {/* Khung Search */}
      <View style={styles.searchBox}>
        <Feather name="search" size={18} color="#6B7280" />
        <TextInput
          placeholder="Tìm kiếm mặt bằng, khu vực..."
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          value={value}
          onChangeText={onChangeValue}
          returnKeyType="search"
        />
      </View>

      {/* Nút Xem Bản đồ (Map) */}
      <TouchableOpacity style={styles.iconBtn} onPress={onPressMap}>
        <Feather name="map" size={18} color="#fff" />
      </TouchableOpacity>

      {/* Nút Thông báo (Bell) */}
      <TouchableOpacity 
        style={styles.iconBtn} 
        // Nếu chưa làm màn hình thông báo thì hiện Alert tạm
        onPress={onPressNotification || (() => Alert.alert('Thông báo', 'Tính năng xem chi tiết thông báo hệ thống đang phát triển.'))}
      >
        <Feather name="bell" size={18} color="#fff" />
        {notificationCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {notificationCount > 99 ? '99+' : notificationCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Nút Lọc (Filter) đã quay trở lại */}
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={onPressFilter || (() => Alert.alert('Sắp ra mắt', 'Bộ lọc theo Giá, Diện tích, Khu vực... đang được phát triển.'))}
      >
        <Feather name="sliders" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0D1117',
    borderBottomWidth: 1,
    borderBottomColor: '#0D1117',
    gap: 8, 
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937', // dark gray for input background
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  iconBtn: {
    width: 38, // Bóp nhỏ lại 1 chút xíu để vừa 3 nút trên màn hình nhỏ
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1F2937', 
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0D1117',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  }
});