import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const passMet6Char = newPassword.length >= 6;
  const passMetLetters = /[a-zA-Z]/.test(newPassword);
  const passMetNumbers = /\d/.test(newPassword);

  const handleSubmit = async () => {
    setErrorMessage('');
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    if (!passMet6Char || !passMetLetters || !passMetNumbers) {
      setErrorMessage('Mật khẩu mới chưa đáp ứng đủ yêu cầu.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      let email = await AsyncStorage.getItem('portal_email');
      const token = await AsyncStorage.getItem('portal_token');
      const userId = await AsyncStorage.getItem('current_user_id');

      if (!token) {
        throw new Error('Không tìm thấy thông tin phiên đăng nhập. Vui lòng đăng nhập lại.');
      }

      // Fallback in case portal_email was not saved during login
      if (!email && userId) {
        const userRes = await fetch(`https://flexi-space-capstone-project.onrender.com/api/User/${userId}`, {
          headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
        });
        if (userRes.ok) {
          const rawUser = await userRes.json();
          const userData = rawUser.data || rawUser;
          if (userData && userData.email) {
            email = userData.email;
            await AsyncStorage.setItem('portal_email', email as string);
          }
        }
      }

      if (!email) {
        throw new Error('Không thể xác định email tài khoản. Vui lòng thử đăng xuất và đăng nhập lại.');
      }

      const response = await fetch('https://flexi-space-capstone-project.onrender.com/api/Auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'accept': '*/*',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          email: email.trim(),
          currentPassword,
          newPassword
        })
      });

      const rawText = (await response.text()).trim();
      let message = '';
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          if (typeof parsed === 'string') {
            message = parsed;
          } else if (parsed && typeof parsed === 'object') {
            message = parsed.message || parsed.detail || parsed.title || rawText;
          }
        } catch {
          message = rawText;
        }
      }

      if (!response.ok) {
        throw new Error(message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.');
      }

      Alert.alert('Thành công', message || 'Đổi mật khẩu thành công.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Đã xảy ra lỗi, vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} disabled={isSubmitting}>
          <Feather name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thay đổi mật khẩu</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Cập nhật mật khẩu</Text>
            <Text style={styles.subtitle}>
              Cập nhật mật khẩu dùng để đăng nhập vào tài khoản của bạn.
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={20} color="#E02424" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mật khẩu hiện tại</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Nhập mật khẩu hiện tại"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showCurrentPassword}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  <Feather name={showCurrentPassword ? "eye" : "eye-off"} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mật khẩu mới</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Nhập mật khẩu mới"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  <Feather name={showNewPassword ? "eye" : "eye-off"} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.passwordReqs}>
                <View style={styles.reqItem}>
                  <Feather name={passMet6Char ? "check-circle" : "circle"} size={14} color={passMet6Char ? "#00A67E" : "#9CA3AF"} />
                  <Text style={[styles.reqText, passMet6Char && styles.reqTextMet]}>Ít nhất 6 ký tự</Text>
                </View>
                <View style={styles.reqItem}>
                  <Feather name={passMetLetters ? "check-circle" : "circle"} size={14} color={passMetLetters ? "#00A67E" : "#9CA3AF"} />
                  <Text style={[styles.reqText, passMetLetters && styles.reqTextMet]}>Có chứa chữ cái</Text>
                </View>
                <View style={styles.reqItem}>
                  <Feather name={passMetNumbers ? "check-circle" : "circle"} size={14} color={passMetNumbers ? "#00A67E" : "#9CA3AF"} />
                  <Text style={[styles.reqText, passMetNumbers && styles.reqTextMet]}>Có chứa chữ số</Text>
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Xác nhận mật khẩu mới</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Nhập lại mật khẩu mới"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]} 
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Lưu thay đổi</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  scrollContent: { padding: 24, paddingBottom: 40 },
  headerTextContainer: { marginBottom: 32 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  errorContainer: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', 
    padding: 12, borderRadius: 8, marginBottom: 24 
  },
  errorText: { color: '#E02424', marginLeft: 8, flex: 1, fontSize: 14, fontWeight: '500' },
  formSection: { gap: 20 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    backgroundColor: '#F9FAFB'
  },
  passwordInput: {
    flex: 1, height: 48, paddingHorizontal: 16,
    fontSize: 16, color: '#111827'
  },
  eyeIcon: { padding: 12 },
  passwordReqs: { marginTop: 8, gap: 4 },
  reqItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText: { fontSize: 13, color: '#6B7280' },
  reqTextMet: { color: '#00A67E', fontWeight: '500' },
  footer: { 
    padding: 24, paddingBottom: 32, 
    borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FFFFFF' 
  },
  primaryButton: { 
    backgroundColor: '#00A67E', height: 50, borderRadius: 25, 
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00A67E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
  },
  primaryButtonDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0, elevation: 0 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
