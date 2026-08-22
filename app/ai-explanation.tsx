import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AIExplanationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleActionClick = async () => {
    const token = await AsyncStorage.getItem('portal_token');
    if (token) {
      router.push('/ai-editor');
    } else {
      router.push('/login');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Chỉnh Sửa Ảnh</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={styles.heroBadge}>
            <Feather name="aperture" size={14} color="#047857" />
            <Text style={styles.heroBadgeText}>Công nghệ AI</Text>
          </View>
          <Text style={styles.heroTitle}>Biến Đổi Không Gian Bằng AI</Text>
          <Text style={styles.heroSubtitle}>
            Tự động nâng cấp hình ảnh mặt bằng của bạn chỉ với vài thao tác kéo thả và mô tả văn bản (Prompt).
          </Text>
        </View>

        <View style={styles.featureContainer}>
          {/* Feature 1 */}
          <View style={styles.featureCard}>
            <View style={styles.featureHeader}>
              <View style={[styles.iconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="edit-2" size={24} color="#047857" />
              </View>
              <Text style={styles.featureTitle}>Tô vùng cần thay đổi (Inpainting)</Text>
            </View>
            <Text style={styles.featureDesc}>
              Bôi đen bất kỳ khu vực nào trên bức ảnh (như tường cũ, sàn nhà, hoặc vật dụng không mong muốn). Sau đó nhập câu lệnh mô tả (ví dụ: "thay vùng tô thành tường gạch trắng, hiện đại"), AI sẽ tự động xử lý và lấp đầy vùng đó một cách tự nhiên nhất.
            </Text>
            <View style={styles.imagePlaceholder}>
              <Feather name="image" size={40} color="#9CA3AF" />
              <Text style={styles.imagePlaceholderText}>Minh hoạ tính năng Tô Vùng</Text>
            </View>
          </View>

          {/* Feature 2 */}
          <View style={styles.featureCard}>
            <View style={styles.featureHeader}>
              <View style={[styles.iconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Feather name="box" size={24} color="#1D4ED8" />
              </View>
              <Text style={styles.featureTitle}>Thêm ảnh vật thể (Object Insertion)</Text>
            </View>
            <Text style={styles.featureDesc}>
              Khởi tạo một vật thể mới trong không gian trống. Chỉ cần tô một vùng trống trên ảnh và yêu cầu AI "Thêm một chậu cây cảnh xanh mát" hoặc "Thêm một bộ bàn ghế sofa", hệ thống sẽ ghép vật thể vào ảnh kèm theo ánh sáng, đổ bóng phù hợp với phối cảnh.
            </Text>
            <View style={styles.imagePlaceholder}>
              <Feather name="monitor" size={40} color="#9CA3AF" />
              <Text style={styles.imagePlaceholderText}>Minh hoạ tính năng Thêm Vật Thể</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleActionClick}>
            <Text style={styles.actionBtnText}>Trải Nghiệm Tính Năng Ngay</Text>
            <Feather name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D1117',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  heroSection: {
    padding: 24,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  heroBadgeText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  featureContainer: {
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 20,
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  featureDesc: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 16,
  },
  imagePlaceholder: {
    height: 160,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
  },
  bottomSection: {
    paddingHorizontal: 16,
  },
  actionBtn: {
    backgroundColor: '#047857',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
