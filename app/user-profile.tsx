import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, TextInput
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';
const EMPTY_DATE = '0001-01-01';
const PLACEHOLDER = 'Chưa cập nhật';

interface ProfileData {
  fullName: string | null;
  citizenIDNumber: string | null;
  gender: string;
  dob: string;
  permanentResidence: string | null;
  dateOfIssue: string;
  isVerified: boolean;
  avatarUrl: string | null;
  bio: string | null;
  socialLink: string | null;
}

const maskEmail = (email: string) => {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.substring(0, 2)}***@${domain}`;
};

const formatDate = (value?: string | null): string => {
  if (!value || value === EMPTY_DATE) return PLACEHOLDER;
  const date = new Date(value);
  if (isNaN(date.getTime())) return PLACEHOLDER;
  return date.toLocaleDateString('vi-VN');
};

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState(PLACEHOLDER);
  const [userPhone, setUserPhone] = useState(PLACEHOLDER);
  const [storedName, setStoredName] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [socialLink, setSocialLink] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('portal_token');
      const userId = await AsyncStorage.getItem('current_user_id');
      if (!token || !userId) {
        router.replace('/login');
        return;
      }

      const [profileRes, userRes] = await Promise.all([
        fetch(`${API_BASE}/api/Profile/me`, {
          headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
        }),
        fetch(`${API_BASE}/api/User/${userId}`, {
          headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
        }),
      ]);

      if (profileRes.ok) {
        setProfile(await profileRes.json());
      }
      if (userRes.ok) {
        const rawUser = await userRes.json();
        const userData = rawUser.data || rawUser;
        setUserEmail(userData?.email || PLACEHOLDER);
        setUserPhone(userData?.phoneNumber || PLACEHOLDER);
        setStoredName(userData?.profileFullName || userData?.userName || null);
      }
    } catch (err) {
      console.error('Lỗi tải hồ sơ:', err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadProfile();
    }, [loadProfile])
  );

  const displayName = profile?.fullName || storedName || PLACEHOLDER;
  const initials = displayName !== PLACEHOLDER ? displayName.substring(0, 2).toUpperCase() : '?';
  const isVerified = profile?.isVerified ?? false;

  const infoRows: [string, string][] = [
    ['Họ và tên', profile?.fullName || storedName || PLACEHOLDER],
    ['Email', userEmail !== PLACEHOLDER ? maskEmail(userEmail) : PLACEHOLDER],
    ['Số điện thoại', userPhone],
    ['Giới tính', profile?.gender || PLACEHOLDER],
    ['Ngày sinh', formatDate(profile?.dob)],
    ['Số CCCD', profile?.citizenIDNumber || PLACEHOLDER],
    ['Nơi thường trú', profile?.permanentResidence || PLACEHOLDER],
    ['Ngày cấp CCCD', formatDate(profile?.dateOfIssue)],
  ];

  const handleStartEdit = () => {
    setAvatarUrl(profile?.avatarUrl || '');
    setBio(profile?.bio || '');
    setSocialLink(profile?.socialLink || '');
    setError('');
    setIsEditing(true);
  };

  const handleSave = async () => {
    setError('');
    setIsSaving(true);
    try {
      const token = await AsyncStorage.getItem('portal_token');
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/Profile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({
          avatarUrl: avatarUrl || undefined,
          bio: bio || undefined,
          socialLink: socialLink || undefined,
        })
      });
      if (!res.ok) throw new Error('Không thể cập nhật hồ sơ. Vui lòng thử lại.');
      setIsEditing(false);
      await loadProfile();
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hồ sơ cá nhân</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00A67E" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {!isVerified && (
            <TouchableOpacity style={styles.warningBanner} onPress={() => router.push('/identity-verification')}>
              <Feather name="alert-triangle" size={16} color="#D97706" />
              <Text style={styles.warningText}>Bạn chưa xác thực định danh. Nhấn để xác thực ngay.</Text>
              <Feather name="chevron-right" size={16} color="#D97706" />
            </TouchableOpacity>
          )}

          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{displayName}</Text>
                <View style={[styles.statusBadge, isVerified ? styles.statusVerified : styles.statusUnverified]}>
                  <Text style={[styles.statusText, { color: isVerified ? '#047857' : '#D97706' }]}>
                    {isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                  </Text>
                </View>
              </View>
              {isVerified && !isEditing && (
                <TouchableOpacity style={styles.editBtn} onPress={handleStartEdit}>
                  <Feather name="edit-2" size={14} color="#00A67E" />
                  <Text style={styles.editBtnText}>Sửa</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.infoTable}>
              {infoRows.map(([label, value]) => (
                <View key={label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
                </View>
              ))}
            </View>

            {isVerified && (
              isEditing ? (
                <View style={styles.editForm}>
                  <Text style={styles.editLabel}>Ảnh đại diện (URL)</Text>
                  <TextInput
                    style={styles.editInput}
                    placeholder="https://..."
                    value={avatarUrl}
                    onChangeText={setAvatarUrl}
                    autoCapitalize="none"
                  />

                  <Text style={styles.editLabel}>Giới thiệu bản thân</Text>
                  <TextInput
                    style={[styles.editInput, { height: 80, textAlignVertical: 'top' }]}
                    multiline
                    value={bio}
                    onChangeText={setBio}
                  />

                  <Text style={styles.editLabel}>Liên kết mạng xã hội</Text>
                  <TextInput
                    style={styles.editInput}
                    placeholder="https://facebook.com/..."
                    value={socialLink}
                    onChangeText={setSocialLink}
                    autoCapitalize="none"
                  />

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.editActionBtn, styles.cancelBtn]}
                      onPress={() => setIsEditing(false)}
                      disabled={isSaving}
                    >
                      <Text style={styles.cancelBtnText}>Huỷ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editActionBtn, styles.saveBtn, isSaving && { opacity: 0.7 }]}
                      onPress={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Lưu</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.infoTable}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Giới thiệu</Text>
                    <Text style={styles.infoValue}>{profile?.bio || PLACEHOLDER}</Text>
                  </View>
                  <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoLabel}>Mạng xã hội</Text>
                    <Text style={styles.infoValue}>{profile?.socialLink || PLACEHOLDER}</Text>
                  </View>
                </View>
              )
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0D1117',
    borderBottomWidth: 1, borderBottomColor: '#0D1117'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 10, padding: 12, marginBottom: 16
  },
  warningText: { flex: 1, fontSize: 12, color: '#92400E' },
  profileCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#00A67E', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  profileName: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusVerified: { backgroundColor: '#ECFDF5' },
  statusUnverified: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#ECFDF5', borderRadius: 8 },
  editBtnText: { fontSize: 12, color: '#00A67E', fontWeight: 'bold' },
  infoTable: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: '600', flex: 1, textAlign: 'right' },
  editForm: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16 },
  editLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  editInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827'
  },
  errorText: { color: '#E02424', fontSize: 12, marginTop: 10 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  editActionBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F3F4F6' },
  cancelBtnText: { color: '#374151', fontWeight: 'bold', fontSize: 13 },
  saveBtn: { backgroundColor: '#00A67E' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});
