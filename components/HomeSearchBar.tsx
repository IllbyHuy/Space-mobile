import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';

type HomeSearchBarProps = {
  value?: string;
  onChangeValue?: (text: string) => void;
};

export const HomeSearchBar = ({ value, onChangeValue }: HomeSearchBarProps) => {
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

      {/* Nút Lọc (Filter) */}
      <TouchableOpacity
        style={styles.filterBtn}
        // Sau này chỗ này sẽ gọi Bottom Sheet hoặc Modal hiện ra 1 đống lựa chọn
        onPress={() => Alert.alert('Sắp ra mắt', 'Bộ lọc theo Giá, Diện tích, Khu vực... đang được phát triển.')}
      >
        <Feather name="sliders" size={18} color="#00A67E" />
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5', // Xanh nhạt
    alignItems: 'center',
    justifyContent: 'center',
  },
});