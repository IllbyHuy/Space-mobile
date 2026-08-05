import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen() {
  const router = useRouter();
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await AsyncStorage.getItem('portal_token');
        const userId = await AsyncStorage.getItem('current_user_id');

        if (!token || !userId) {
          throw new Error('Không tìm thấy thông tin đăng nhập');
        }

        const response = await fetch(`https://flexi-space-capstone-project.onrender.com/api/User/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'accept': '*/*'
          }
        });

        if (!response.ok) throw new Error('Không thể tải profile');

        const rawData = await response.json();
        
        // IN RA TERMINAL ĐỂ SOI DỮ LIỆU THẬT
        console.log("=== API PROFILE TRẢ VỀ ===", JSON.stringify(rawData, null, 2));

        // Chuẩn hóa: Nếu backend bọc trong rawData.data thì lấy cái đó, không thì lấy luôn rawData
        const safeData = rawData.data || rawData;
        setUserProfile(safeData);

      } catch (error) {
        console.error("Lỗi tải Profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['portal_token', 'current_user_id']);
    router.replace('/login');
  };

  const MenuItem = ({ icon, title, onPress, color = '#111827' }: { icon: any, title: string, onPress: () => void, color?: string }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIconWrap}>
        <Feather name={icon} size={20} color={color === '#E02424' ? '#E02424' : '#6B7280'} />
      </View>
      <Text style={[styles.menuTitle, { color }]}>{title}</Text>
      <Feather name="chevron-right" size={20} color="#D1D5DB" />
    </TouchableOpacity>
  );

  // BẮT LỖI TÊN BIẾN (Chơi bao lô cả viết hoa lẫn viết thường)
  const fullName = userProfile?.profileFullName || userProfile?.ProfileFullName || userProfile?.userName || userProfile?.UserName || 'Người dùng mới';
  const emailStr = userProfile?.email || userProfile?.Email || 'Đang cập nhật email';
  const roleStr = userProfile?.role || userProfile?.Role;
  const avatarUrl = userProfile?.profileAvatarUrl || userProfile?.ProfileAvatarUrl;
  const shortName = fullName.substring(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cá nhân</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00A67E" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          <View style={styles.profileSection}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{shortName}</Text>
              </View>
            )}
            
            <View style={styles.infoWrap}>
              <Text style={styles.userName}>{fullName}</Text>
              <Text style={styles.userEmail}>{emailStr}</Text>
              
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                 <Text style={styles.roleBadge}>{roleStr === 'Admin' || roleStr === 'admin' ? 'Quản trị viên' : 'Thành viên'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editBtn}>
              <Feather name="edit-2" size={18} color="#00A67E" />
            </TouchableOpacity>
          </View>

          <View style={styles.menuSection}>
            <Text style={styles.sectionLabel}>Tài khoản</Text>
            <View style={styles.card}>
              <MenuItem icon="user" title="Hồ sơ cá nhân" onPress={() => {}} />
              <MenuItem icon="calendar" title="Quản lý lịch hẹn" onPress={() => {}} />
              <MenuItem icon="credit-card" title="Ví & Thanh toán" onPress={() => {}} />
            </View>

            <Text style={styles.sectionLabel}>Hệ thống</Text>
            <View style={styles.card}>
              <MenuItem icon="settings" title="Cài đặt" onPress={() => {}} />
              <MenuItem icon="help-circle" title="Trợ giúp & Hỗ trợ" onPress={() => {}} />
            </View>
            
            <View style={[styles.card, { marginTop: 16 }]}>
              <MenuItem icon="log-out" title="Đăng xuất" color="#E02424" onPress={handleLogout} />
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Giữ nguyên phần styles như cũ
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  profileSection: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: '#fff', padding: 20, 
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB'
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { 
    width: 64, height: 64, borderRadius: 32, 
    backgroundColor: '#00A67E', justifyContent: 'center', alignItems: 'center' 
  },
  avatarText: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  infoWrap: { flex: 1, marginLeft: 16 },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 2 },
  userEmail: { fontSize: 14, color: '#6B7280' },
  roleBadge: { backgroundColor: '#ECFDF5', color: '#00A67E', fontSize: 12, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  editBtn: { 
    width: 40, height: 40, borderRadius: 20, 
    backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' 
  },
  menuSection: { padding: 16 },
  sectionLabel: { fontSize: 13, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4, marginTop: 16 },
  card: { 
    backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E5E7EB'
  },
  menuItem: { 
    flexDirection: 'row', alignItems: 'center', 
    paddingVertical: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6'
  },
  menuIconWrap: { width: 24, alignItems: 'center', marginRight: 12 },
  menuTitle: { flex: 1, fontSize: 16, fontWeight: '500' }
});