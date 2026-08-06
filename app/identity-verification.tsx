import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseCccdQr, type CccdQrData } from '@/utils/parseCccdQr';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScanState = 'idle' | 'scanning' | 'success' | 'error';
type Source = 'camera' | 'upload';

const NO_QR_FOUND_MESSAGE = 'Không tìm thấy mã QR trong ảnh, vui lòng thử ảnh rõ nét hơn.';

export default function IdentityVerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [source, setSource] = useState<Source>('camera');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanError, setScanError] = useState<string | null>(null);
  const [data, setData] = useState<CccdQrData | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [alreadyVerified, setAlreadyVerified] = useState<boolean | null>(null);

  React.useEffect(() => {
    const checkVerified = async () => {
      try {
        const token = await AsyncStorage.getItem('portal_token');
        if (!token) return;
        const res = await fetch('https://flexi-space-capstone-project.onrender.com/api/Profile/me', {
          headers: { Authorization: `Bearer ${token}`, accept: '*/*' }
        });
        if (res.ok) {
          const profile = await res.json();
          setAlreadyVerified(!!profile?.isVerified);
        }
      } catch (err) {
        console.error('Lỗi kiểm tra trạng thái xác thực:', err);
      }
    };
    checkVerified();
  }, []);

  const applyParseResult = (rawText: string) => {
    const result = parseCccdQr(rawText);
    if (result.success) {
      setData(result.data);
      setScanState('success');
      setIsCameraActive(false);
      return true;
    }
    setScanError(result.error.message);
    setScanState('error');
    return false;
  };

  const handleBarcodeScanned = ({ data: rawText }: { data: string }) => {
    if (scanState === 'success' || !isCameraActive) return;
    applyParseResult(rawText);
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh để tải ảnh CCCD lên.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setScanState('scanning');
    setScanError(null);
    setData(null);
    try {
      const scanResults = await scanFromURLAsync(result.assets[0].uri, ['qr']);
      if (scanResults.length > 0) {
        applyParseResult(scanResults[0].data);
      } else {
        setScanError(NO_QR_FOUND_MESSAGE);
        setScanState('error');
      }
    } catch (err) {
      console.error('Lỗi quét ảnh:', err);
      setScanError(NO_QR_FOUND_MESSAGE);
      setScanState('error');
    }
  };

  const handleSelectSource = (next: Source) => {
    if (next === source) return;
    setSource(next);
    setScanState('idle');
    setScanError(null);
    setData(null);
    setIsCameraActive(next === 'camera');
  };

  const handleReset = () => {
    setScanState('idle');
    setScanError(null);
    setData(null);
    setIsCameraActive(source === 'camera');
  };

  const handleConfirm = async () => {
    if (!data) return;
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const userId = await AsyncStorage.getItem('current_user_id');
      const token = await AsyncStorage.getItem('portal_token');
      if (!userId || !token) throw new Error('Vui lòng đăng nhập lại.');

      const normalizedGender = /^nam$|^male$/i.test(data.gender.trim()) ? 'Male' : 'Female';
      const response = await fetch(`https://flexi-space-capstone-project.onrender.com/api/Profile/${userId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({
          citizenIDNumber: data.idNumber,
          identityCardNumber: data.idNumber,
          fullName: data.fullName,
          gender: normalizedGender,
          dob: data.dateOfBirthIso,
          permanentResidence: data.permanentAddress,
          dateOfIssue: data.issueDateIso,
        })
      });

      if (!response.ok) throw new Error('Không thể xác thực định danh. Vui lòng thử lại.');

      setAlreadyVerified(true);
      Alert.alert('Thành công', 'Xác thực định danh thành công!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      setSubmitError(err.message || 'Xác thực thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldRows: [string, string][] = data
    ? [
        ['Số CCCD', data.idNumber],
        ['Họ và tên', data.fullName],
        ['Ngày sinh', data.dateOfBirthIso],
        ['Giới tính', data.gender],
        ['Nơi thường trú', data.permanentAddress],
        ['Ngày cấp', data.issueDateIso],
      ]
    : [];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Xác thực định danh</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Quét mã QR mặt sau CCCD để tự động điền thông tin định danh của bạn.
        </Text>

        {alreadyVerified ? (
          <View style={styles.verifiedBox}>
            <Feather name="check-circle" size={20} color="#00A67E" />
            <Text style={styles.verifiedText}>Định danh của bạn đã được xác thực.</Text>
          </View>
        ) : (
          <>
            {scanState !== 'success' && (
              <>
                <View style={styles.sourceToggle}>
                  <TouchableOpacity
                    style={[styles.sourceBtn, source === 'camera' && styles.sourceBtnActive]}
                    onPress={() => handleSelectSource('camera')}
                  >
                    <Text style={[styles.sourceBtnText, source === 'camera' && styles.sourceBtnTextActive]}>QUÉT CAMERA</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sourceBtn, source === 'upload' && styles.sourceBtnActive]}
                    onPress={() => handleSelectSource('upload')}
                  >
                    <Text style={[styles.sourceBtnText, source === 'upload' && styles.sourceBtnTextActive]}>UPLOAD ẢNH</Text>
                  </TouchableOpacity>
                </View>

                {source === 'camera' ? (
                  <View style={styles.cameraWrap}>
                    {!permission ? (
                      <ActivityIndicator color="#00A67E" style={{ marginVertical: 40 }} />
                    ) : !permission.granted ? (
                      <View style={styles.permissionBox}>
                        <Feather name="camera-off" size={32} color="#9CA3AF" />
                        <Text style={styles.permissionText}>Cần quyền truy cập camera để quét mã QR.</Text>
                        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                          <Text style={styles.permissionBtnText}>Cấp quyền camera</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.cameraBox}>
                        <CameraView
                          style={StyleSheet.absoluteFillObject}
                          facing="back"
                          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                          onBarcodeScanned={isCameraActive ? handleBarcodeScanned : undefined}
                        />
                        <View style={styles.scanFrame} pointerEvents="none" />
                      </View>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadBox} onPress={handlePickImage} disabled={scanState === 'scanning'}>
                    {scanState === 'scanning' ? (
                      <ActivityIndicator color="#00A67E" />
                    ) : (
                      <>
                        <Feather name="upload" size={28} color="#00A67E" />
                        <Text style={styles.uploadText}>Chọn ảnh CCCD từ thư viện</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {scanState === 'error' && scanError && (
                  <Text style={styles.errorText}>{scanError}</Text>
                )}
              </>
            )}

            {scanState === 'success' && data && (
              <View style={styles.reviewBox}>
                {fieldRows.map(([label, value]) => (
                  <View key={label} style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>{label}</Text>
                    <Text style={styles.reviewValue}>{value}</Text>
                  </View>
                ))}

                {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

                <TouchableOpacity
                  style={[styles.confirmBtn, isSubmitting && { opacity: 0.7 }]}
                  onPress={handleConfirm}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>XÁC NHẬN THÔNG TIN</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.rescanBtn} onPress={handleReset} disabled={isSubmitting}>
                  <Text style={styles.rescanBtnText}>QUÉT LẠI</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  description: { fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 20 },
  verifiedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ECFDF5', padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#A7F3D0'
  },
  verifiedText: { color: '#047857', fontSize: 14, fontWeight: '600', flex: 1 },
  sourceToggle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  sourceBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB'
  },
  sourceBtnActive: { backgroundColor: '#00A67E', borderColor: '#00A67E' },
  sourceBtnText: { fontSize: 13, fontWeight: 'bold', color: '#6B7280' },
  sourceBtnTextActive: { color: '#fff' },
  cameraWrap: { marginBottom: 16 },
  cameraBox: { height: 320, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  scanFrame: {
    position: 'absolute', top: '22%', left: '22%', right: '22%', bottom: '22%',
    borderWidth: 2, borderColor: '#00D4A0', borderRadius: 12
  },
  permissionBox: {
    height: 220, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12
  },
  permissionText: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  permissionBtn: { backgroundColor: '#00A67E', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  permissionBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  uploadBox: {
    height: 220, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderStyle: 'dashed', borderColor: '#00A67E',
    alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16
  },
  uploadText: { fontSize: 14, color: '#00A67E', fontWeight: '600' },
  errorText: { color: '#E02424', fontSize: 13, marginTop: 4, marginBottom: 8 },
  reviewBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  reviewLabel: { fontSize: 13, color: '#6B7280' },
  reviewValue: { fontSize: 13, color: '#111827', fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 12 },
  confirmBtn: { backgroundColor: '#00A67E', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  rescanBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  rescanBtnText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
});
