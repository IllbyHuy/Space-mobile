import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const passMet6Char = newPassword.length >= 6;
  const passMetLetters = /[a-zA-Z]/.test(newPassword);
  const passMetNumbers = /\d/.test(newPassword);

  const handleRequestReset = async () => {
    setErrorMessage('');
    if (!email.trim()) {
      setErrorMessage('Vui lòng nhập địa chỉ email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('https://flexi-space-capstone-project.onrender.com/api/Auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({ email: email.trim() })
      });

      if (!response.ok) {
        const rawText = await response.text();
        let data: any = {};
        try { data = rawText ? JSON.parse(rawText) : {}; } catch {}
        throw new Error(data.message || data.title || 'Không thể gửi yêu cầu đặt lại mật khẩu.');
      }

      setStep('reset');
      Alert.alert('Đã gửi', `Mã OTP đã được gửi đến ${email}.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setErrorMessage('');
    if (!otpCode.trim() || !newPassword || !confirmPassword) {
      setErrorMessage('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    if (!passMet6Char || !passMetLetters || !passMetNumbers) {
      setErrorMessage('Mật khẩu chưa đáp ứng đủ yêu cầu.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('https://flexi-space-capstone-project.onrender.com/api/Auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({ email: email.trim(), otpCode: otpCode.trim(), newPassword })
      });

      if (!response.ok) {
        const rawText = await response.text();
        let data: any = {};
        try { data = rawText ? JSON.parse(rawText) : {}; } catch {}
        throw new Error(data.message || data.title || 'Không thể đặt lại mật khẩu.');
      }

      Alert.alert('Thành công', 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.', [
        { text: 'Về đăng nhập', onPress: () => router.replace('/login') }
      ]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color="#fff" />
            <Text style={styles.backBtnText}>Quay lại</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Quên mật khẩu</Text>
          <Text style={styles.subtitle}>
            {step === 'request'
              ? 'Nhập email tài khoản để nhận mã OTP'
              : 'Nhập mã OTP và mật khẩu mới của bạn'}
          </Text>

          {step === 'request' ? (
            <>
              <View style={styles.inputWrapper}>
                <Feather name="mail" size={20} color="#8b949e" style={styles.inputIcon} />
                <TextInput
                  style={styles.input} placeholder="Nhập địa chỉ Email" placeholderTextColor="#8b949e"
                  keyboardType="email-address" autoCapitalize="none"
                  value={email} onChangeText={(t) => { setEmail(t); setErrorMessage(''); }} editable={!isSubmitting}
                />
              </View>

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={16} color="#f85149" style={{ marginTop: 2 }} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} onPress={handleRequestReset} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#0D1117" /> : <Text style={styles.submitBtnText}>Gửi mã OTP</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.inputWrapper}>
                <Feather name="key" size={20} color="#8b949e" style={styles.inputIcon} />
                <TextInput
                  style={styles.input} placeholder="Nhập mã OTP 6 số" placeholderTextColor="#8b949e"
                  keyboardType="number-pad" maxLength={6}
                  value={otpCode} onChangeText={(t) => { setOtpCode(t); setErrorMessage(''); }} editable={!isSubmitting}
                />
              </View>

              <View style={styles.inputWrapper}>
                <Feather name="lock" size={20} color="#8b949e" style={styles.inputIcon} />
                <TextInput
                  style={styles.input} placeholder="Mật khẩu mới" placeholderTextColor="#8b949e"
                  secureTextEntry={!showPassword}
                  value={newPassword} onChangeText={(t) => { setNewPassword(t); setErrorMessage(''); }} editable={!isSubmitting}
                />
                <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#8b949e" />
                </TouchableOpacity>
              </View>

              <View style={styles.checkList}>
                <Text style={[styles.checkItem, passMet6Char && styles.checkItemMet]}>{passMet6Char ? '✓' : '○'} Ít nhất 6 ký tự</Text>
                <Text style={[styles.checkItem, passMetLetters && styles.checkItemMet]}>{passMetLetters ? '✓' : '○'} Chứa chữ cái</Text>
                <Text style={[styles.checkItem, passMetNumbers && styles.checkItemMet]}>{passMetNumbers ? '✓' : '○'} Chứa chữ số</Text>
              </View>

              <View style={styles.inputWrapper}>
                <Feather name="shield" size={20} color="#8b949e" style={styles.inputIcon} />
                <TextInput
                  style={styles.input} placeholder="Xác nhận mật khẩu mới" placeholderTextColor="#8b949e"
                  secureTextEntry={!showPassword}
                  value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); setErrorMessage(''); }} editable={!isSubmitting}
                />
              </View>

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={16} color="#f85149" style={{ marginTop: 2 }} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[styles.submitBtn, styles.secondaryBtn, { flex: 1 }]}
                  onPress={() => { setStep('request'); setErrorMessage(''); }}
                  disabled={isSubmitting}
                >
                  <Text style={styles.secondaryBtnText}>Quay lại</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.submitBtn, { flex: 1 }, isSubmitting && { opacity: 0.7 }]} onPress={handleResetPassword} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#0D1117" /> : <Text style={styles.submitBtnText}>Đặt lại mật khẩu</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Đã nhớ mật khẩu? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.footerLink}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtnText: { color: '#fff', fontSize: 15, marginLeft: 4 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { color: '#8b949e', fontSize: 13, marginBottom: 28 },
  inputWrapper: { position: 'relative', justifyContent: 'center', marginBottom: 16 },
  inputIcon: { position: 'absolute', left: 16, zIndex: 1 },
  input: {
    backgroundColor: '#1A2332', borderWidth: 1, borderColor: '#2A3A4A',
    borderRadius: 12, color: '#fff', paddingLeft: 46, paddingRight: 46, paddingVertical: 16, fontSize: 15,
  },
  eyeIcon: { position: 'absolute', right: 16, padding: 4 },
  checkList: { marginBottom: 16, marginTop: -6, gap: 4 },
  checkItem: { fontSize: 12, color: '#8b949e' },
  checkItemMet: { color: '#00D4A0' },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    borderWidth: 1, borderColor: 'rgba(248, 81, 73, 0.4)',
    borderRadius: 8, padding: 12, marginBottom: 16, gap: 8
  },
  errorText: { color: '#f85149', fontSize: 13, flex: 1, lineHeight: 20 },
  submitBtn: { backgroundColor: '#00D4A0', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: '#0D1117', fontSize: 16, fontWeight: 'bold' },
  secondaryBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2A3A4A' },
  secondaryBtnText: { color: '#c9d1d9', fontSize: 16, fontWeight: 'bold' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { color: '#8b949e', fontSize: 14 },
  footerLink: { color: '#00D4A0', fontSize: 14, fontWeight: 'bold' }
});
