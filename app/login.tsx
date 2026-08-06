import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Animated, Dimensions, LayoutAnimation, UIManager,
  ScrollView
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { forceRegisterAndSavePushToken } from '@/hooks/usePushNotifications';

const { height } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AuthScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });
  
  const [isLoginMode, setIsLoginMode] = useState(true); 
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // STATE LƯU THÔNG BÁO LỖI HIỂN THỊ TRỰC TIẾP LÊN UI
  const [errorMessage, setErrorMessage] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState(''); 

  const startupAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(1000), 
      Animated.timing(startupAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true, 
      })
    ]).start();
  }, []);

  const toggleAuthMode = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsLoginMode(!isLoginMode);
    setShowOtpForm(false); 
    setErrorMessage(''); // Xóa lỗi khi đổi tab
  };

  const handleSubmit = async () => {
    setErrorMessage(''); // Reset lỗi trước khi gọi API

    // ---------------- LƯỜNG 1: XỬ LÝ NHẬP OTP ----------------
    if (showOtpForm) {
      if (!otpCode) {
        setErrorMessage('Vui lòng nhập mã OTP 6 số.');
        return;
      }
      setIsLoading(true);
      try {
        const response = await fetch('https://flexi-space-capstone-project.onrender.com/api/Auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'accept': '*/*' },
          body: JSON.stringify({ email, otpCode })
        });
        
        const rawText = await response.text();
        let data: any = {};
        try { data = rawText ? JSON.parse(rawText) : {}; } catch {}
        
        if (!response.ok) throw new Error(data.message || 'Xác thực OTP thất bại. Vui lòng kiểm tra lại mã.');
        
        if (data.accessToken) {
            Alert.alert('Thành công', 'Xác thực tài khoản thành công!', [
              { text: 'Vào App ngay', onPress: () => router.replace('/') }
            ]);
        } else {
            Alert.alert('Thành công', 'Xác thực tài khoản thành công! Vui lòng đăng nhập lại.');
            toggleAuthMode();
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Lỗi xác thực.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ---------------- LƯỜNG 2: XỬ LÝ LOGIN / REGISTER ----------------
    if (!email || !password) {
      setErrorMessage('Vui lòng điền Email và Mật khẩu.');
      return;
    }
    if (!isLoginMode) {
      if (!name || !phone || !confirmPassword) {
        setErrorMessage('Vui lòng điền đầy đủ thông tin đăng ký.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Mật khẩu xác nhận không khớp.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const endpoint = isLoginMode ? 'login' : 'register';
      const payload = isLoginMode 
        ? { email, password, turnstileToken: "bypass" } 
        : { email, password, name, userName: name, phoneNumber: phone, turnstileToken: "bypass" };

      const response = await fetch(`https://flexi-space-capstone-project.onrender.com/api/Auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': '*/*' },
        body: JSON.stringify(payload)
      });

      const rawText = await response.text();
      let data: any = {};
      try { data = rawText ? JSON.parse(rawText) : {}; } catch {}

      // LOGIC "BÓC TÁCH" LỖI TỪ BACKEND (.NET VALIDATION)
      if (!response.ok) {
        let errorString = data.message || '';
        
        // Nếu Backend trả về cục 'errors' (như lỗi trùng email, mk yếu...)
        if (data.errors && typeof data.errors === 'object') {
          const errorMessages = [];
          for (const key in data.errors) {
            if (Array.isArray(data.errors[key])) {
              errorMessages.push(data.errors[key][0]); // Lấy dòng lỗi đầu tiên của mỗi field
            }
          }
          if (errorMessages.length > 0) {
            errorString = errorMessages.join('\n'); // Gộp các lỗi lại xuống dòng
          }
        }
        
        // Nếu vẫn không moi được lỗi nào, dùng title mặc định của nó
        if (!errorString) errorString = data.title || 'Có lỗi xảy ra, vui lòng thử lại.';
        
        throw new Error(errorString);
      }

      // XỬ LÝ THÀNH CÔNG
      if (isLoginMode || showOtpForm) {
        if (data.accessToken) {
          await AsyncStorage.setItem('portal_token', data.accessToken);
        }
        
        const messageStr = data.message || '';
        const idMatch = messageStr.match(/ID:\s*([A-Za-z0-9]+)/i);
        if (idMatch && idMatch[1]) {
          await AsyncStorage.setItem('current_user_id', idMatch[1]);
        }

        // Đăng ký push token ngay sau khi login thành công
        forceRegisterAndSavePushToken();

        // BỎ ALERT ĐI, ĐÁ THẲNG VÀO TRANG CHỦ LUÔN!
        router.replace('/');
      } else {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowOtpForm(true); 
        Alert.alert('Đăng ký thành công!', 'Vui lòng kiểm tra email để nhận mã OTP.');
      }
    } catch (err: any) {
      // IN RA CÁI BẢNG MÀU ĐỎ ĐÓ THAY VÌ HIỆN POPUP ALERT
      setErrorMessage(err.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  const logoTranslateY = startupAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -height * 0.22], 
  });

  const formOpacity = startupAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1], 
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#00D4A0" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>

          <Animated.View style={[styles.headerContainer, { transform: [{ translateY: logoTranslateY }] }]}>
            <Text style={styles.logoText}>Ether<Text style={styles.logoAccent}>Space</Text></Text>
            <Animated.Text style={[styles.slogan, { opacity: formOpacity }]}>
              {showOtpForm ? 'Xác thực tài khoản của bạn' : (isLoginMode ? 'Nền tảng cho thuê không gian linh hoạt' : 'Gia nhập cộng đồng ngay hôm nay')}
            </Animated.Text>
          </Animated.View>

          <Animated.View style={[styles.formContainer, { opacity: formOpacity }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              
              {showOtpForm ? (
                <View style={styles.inputWrapper}>
                  <Feather name="key" size={20} color="#8b949e" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} placeholder="Nhập mã OTP 6 số" placeholderTextColor="#8b949e"
                    keyboardType="number-pad" value={otpCode} onChangeText={(text) => {setOtpCode(text); setErrorMessage('');}} editable={!isLoading}
                    maxLength={6}
                  />
                </View>
              ) : (
                <>
                  <View style={styles.inputWrapper}>
                    <Feather name="mail" size={20} color="#8b949e" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} placeholder="Email" placeholderTextColor="#8b949e"
                      keyboardType="email-address" autoCapitalize="none"
                      value={email} onChangeText={(text) => {setEmail(text); setErrorMessage('');}} editable={!isLoading}
                    />
                  </View>

                  {!isLoginMode && (
                    <>
                      <View style={styles.inputWrapper}>
                        <Feather name="user" size={20} color="#8b949e" style={styles.inputIcon} />
                        <TextInput 
                          style={styles.input} placeholder="Họ và tên" placeholderTextColor="#8b949e"
                          value={name} onChangeText={(text) => {setName(text); setErrorMessage('');}} editable={!isLoading}
                        />
                      </View>
                      <View style={styles.inputWrapper}>
                        <Feather name="phone" size={20} color="#8b949e" style={styles.inputIcon} />
                        <TextInput 
                          style={styles.input} placeholder="Số điện thoại" placeholderTextColor="#8b949e"
                          keyboardType="phone-pad" value={phone} onChangeText={(text) => {setPhone(text); setErrorMessage('');}} editable={!isLoading}
                        />
                      </View>
                    </>
                  )}

                  <View style={styles.inputWrapper}>
                    <Feather name="lock" size={20} color="#8b949e" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} placeholder="Mật khẩu" placeholderTextColor="#8b949e"
                      secureTextEntry={!showPassword} value={password} onChangeText={(text) => {setPassword(text); setErrorMessage('');}} editable={!isLoading}
                    />
                    <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                      <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#8b949e" />
                    </TouchableOpacity>
                  </View>

                  {!isLoginMode && (
                    <View style={styles.inputWrapper}>
                      <Feather name="shield" size={20} color="#8b949e" style={styles.inputIcon} />
                      <TextInput 
                        style={styles.input} placeholder="Xác nhận mật khẩu" placeholderTextColor="#8b949e"
                        secureTextEntry={!showPassword} value={confirmPassword} onChangeText={(text) => {setConfirmPassword(text); setErrorMessage('');}} editable={!isLoading}
                      />
                    </View>
                  )}

                  {isLoginMode && (
                    <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: 20 }} onPress={() => router.push('/forgot-password')}>
                      <Text style={{ color: '#00D4A0', fontSize: 13, fontWeight: 'bold' }}>Quên mật khẩu?</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* KHU VỰC HIỂN THỊ LỖI */}
              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={16} color="#f85149" style={{ marginTop: 2 }} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={[styles.submitBtn, isLoading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#0D1117" /> : <Text style={styles.submitBtnText}>{showOtpForm ? 'Xác nhận OTP' : (isLoginMode ? 'Đăng nhập' : 'Tạo tài khoản')}</Text>}
              </TouchableOpacity>

              {!showOtpForm && (
                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>{isLoginMode ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}</Text>
                  <TouchableOpacity onPress={toggleAuthMode}>
                    <Text style={styles.footerLink}>{isLoginMode ? 'Đăng ký ngay' : 'Đăng nhập'}</Text>
                  </TouchableOpacity>
                </View>
              )}

            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  headerContainer: { alignItems: 'center', marginBottom: 30, position: 'absolute', width: '100%' },
  logoText: { fontSize: 24, fontFamily: 'PressStart2P_400Regular', color: '#fff' },
  logoAccent: { color: '#00D4A0', fontFamily: 'PressStart2P_400Regular', fontSize: 24 },
  slogan: { color: '#8b949e', fontSize: 13, marginTop: 12, textAlign: 'center' },
  formContainer: { flexGrow: 0, paddingHorizontal: 24, marginTop: height * 0.15 },
  inputWrapper: { position: 'relative', justifyContent: 'center', marginBottom: 16 },
  inputIcon: { position: 'absolute', left: 16, zIndex: 1 },
  input: {
    backgroundColor: '#1A2332', borderWidth: 1, borderColor: '#2A3A4A',
    borderRadius: 12, color: '#fff', paddingLeft: 46, paddingRight: 46, paddingVertical: 16, fontSize: 15,
  },
  eyeIcon: { position: 'absolute', right: 16, padding: 4 },
  
  // STYLE CHO THÔNG BÁO LỖI
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    borderWidth: 1, borderColor: 'rgba(248, 81, 73, 0.4)',
    borderRadius: 8, padding: 12, marginBottom: 16, gap: 8
  },
  errorText: { color: '#f85149', fontSize: 13, flex: 1, lineHeight: 20 },

  submitBtn: { backgroundColor: '#00D4A0', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: '#0D1117', fontSize: 16, fontWeight: 'bold' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { color: '#8b949e', fontSize: 14 },
  footerLink: { color: '#00D4A0', fontSize: 14, fontWeight: 'bold' }
});