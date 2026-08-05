import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export const HomeSearchBar = () => {
  return (
    <View style={styles.container}>
      {/* Khung Search */}
      <View style={styles.searchBox}>
        <Feather name="search" size={18} color="#6B7280" />
        <TextInput 
          placeholder="Tìm kiếm mặt bằng, khu vực..."
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
      </View>

      {/* Nút Lọc (Filter) */}
      <TouchableOpacity 
        style={styles.filterBtn}
        // Sau này chỗ này sẽ gọi Bottom Sheet hoặc Modal hiện ra 1 đống lựa chọn
        onPress={() => alert('Sẽ mở bảng Chọn Bộ Lọc (Giá, Diện tích, Khu vực...)')}
      >
        <Feather name="sliders" size={18} color="#00A67E" />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>3</Text>
        </View>
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  filterBtn: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5', // Xanh nhạt
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#E02424',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  }
});