import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, PanResponder, ActivityIndicator, Alert, Dimensions, ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomNavBar } from '@/components/BottomNavBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Point = { x: number, y: number };
type Stroke = { id: string; points: Point[]; size: number };

export default function AiEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<ViewShot>(null);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Images
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: SCREEN_WIDTH, height: SCREEN_WIDTH });
  const [objectImageUri, setObjectImageUri] = useState<string | null>(null);
  const [objectImageBase64, setObjectImageBase64] = useState<string | null>(null);

  // Drawing
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const brushSize = 30;

  // Processing
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  
  // Save Image
  const [isSaving, setIsSaving] = useState(false);
  
  // Drawing Modal Mode
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = await AsyncStorage.getItem('portal_token');
      if (!storedToken) {
        router.replace('/login');
        return;
      }
      setToken(storedToken);
      fetchWallet(storedToken);
      setCheckingAuth(false);
    };
    checkAuth();
  }, []);

  const fetchWallet = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/Wallet/own`, {
        headers: { Authorization: `Bearer ${authToken}`, accept: '*/*' }
      });
      if (res.ok) {
        const data = await res.json();
        setWalletBalance(data.balance || 0);
      }
    } catch (error) {
      console.log('Error fetching wallet', error);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      Image.getSize(uri, (w, h) => {
        const ratio = Math.min(SCREEN_WIDTH / w, SCREEN_WIDTH / h);
        setImageSize({ width: w * ratio, height: h * ratio });
        setImageUri(uri);
        setStrokes([]);
        setResultUrl(null);
      });
    }
  };

  const pickObjectImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setObjectImageUri(result.assets[0].uri);
      if (result.assets[0].base64) {
        setObjectImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    }
  };

  // Pan Responder for drawing
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentStroke({
          id: Date.now().toString(),
          points: [{ x: locationX, y: locationY }],
          size: brushSize
        });
      },
      onPanResponderMove: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentStroke(prev => {
          if (!prev) return prev;
          return { ...prev, points: [...prev.points, { x: locationX, y: locationY }] };
        });
      },
      onPanResponderRelease: () => {
        setCurrentStroke(prev => {
          if (prev) setStrokes(s => [...s, prev]);
          return null;
        });
      }
    })
  ).current;

  const getPathData = (points: Point[]) => {
    if (points.length === 0) return '';
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return d;
  };

  const handleUndo = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setStrokes([]);
  };

  const handleGenerate = async () => {
    if (!imageUri) return Alert.alert('Lỗi', 'Vui lòng chọn ảnh gốc.');
    if (strokes.length === 0) return Alert.alert('Lỗi', 'Hãy tô vùng cần chỉnh sửa trên ảnh.');
    if (!prompt.trim()) return Alert.alert('Lỗi', 'Vui lòng nhập Prompt AI.');
    if (!token) return;

    try {
      setIsProcessing(true);
      // Capture the masked image (base64)
      const base64MaskedImage = await viewShotRef.current?.capture();
      if (!base64MaskedImage) throw new Error('Không thể chụp ảnh khoanh vùng.');
      
      const payload = {
        base64Image: `data:image/jpeg;base64,${base64MaskedImage}`,
        base64Obj: objectImageBase64 || null,
        prompt: prompt.trim()
      };

      const response = await fetch(`${API_BASE}/api/AITool/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const raw = await response.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        if (raw.startsWith('http') || raw.startsWith('data:image')) {
          data = { imageUrl: raw };
        } else {
          throw new Error('Lỗi AI: ' + raw.substring(0, 50));
        }
      }

      if (!response.ok) {
        throw new Error(data.message || 'Lỗi khi gọi AI.');
      }

      const generatedUrl = data.imageUrl || data.result || data.generatedImage;
      if (generatedUrl) {
        let finalUrl = generatedUrl;
        if (!finalUrl.startsWith('http') && !finalUrl.startsWith('data:image')) {
          finalUrl = `data:image/png;base64,${finalUrl}`;
        }
        setResultUrl(finalUrl);
        Alert.alert('Thành công', 'Đã tạo ảnh thành công!');
        fetchWallet(token); // refresh wallet
      } else {
        throw new Error('API không trả về ảnh.');
      }

    } catch (error: any) {
      Alert.alert('Thất bại', error.message || 'Đã có lỗi xảy ra.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveImage = async () => {
    if (!resultUrl) return;
    
    try {
      setIsSaving(true);

      let localUri = resultUrl;

      if (resultUrl.startsWith('http')) {
        const fileExt = resultUrl.split('.').pop()?.split('?')[0] || 'jpg';
        const fileUri = `${FileSystem.documentDirectory}ai_image_${Date.now()}.${fileExt}`;
        const { uri } = await FileSystem.downloadAsync(resultUrl, fileUri);
        localUri = uri;
      } else if (resultUrl.startsWith('data:image')) {
        const base64Data = resultUrl.split(',')[1];
        const fileUri = `${FileSystem.documentDirectory}ai_image_${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        localUri = fileUri;
      }

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Lưu hoặc chia sẻ ảnh',
          UTI: 'public.image'
        });
      } else {
        Alert.alert('Lỗi', 'Thiết bị không hỗ trợ chia sẻ/lưu ảnh.');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể lưu ảnh: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (checkingAuth) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Chỉnh ảnh</Text>
        <TouchableOpacity style={styles.historyBtn} onPress={() => router.push('/ai-history')}>
          <MaterialCommunityIcons name="history" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
          
          {/* Wallet */}
          <View style={styles.walletContainer}>
            <Text style={styles.walletText}>Số dư: {walletBalance != null ? walletBalance.toLocaleString('vi-VN') + ' VND' : '...'}</Text>
          </View>

          {/* Workspace */}
          <View style={styles.workspace}>
            {resultUrl ? (
              <Image source={{ uri: resultUrl }} style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH, resizeMode: 'contain' }} />
            ) : imageUri ? (
              <TouchableOpacity onPress={() => setIsDrawingMode(true)} activeOpacity={0.9} style={{ width: imageSize.width, height: imageSize.height }}>
                <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9, result: 'base64' }}>
                  <View style={{ width: imageSize.width, height: imageSize.height }}>
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%', position: 'absolute' }} />
                    <Svg style={{ width: '100%', height: '100%', position: 'absolute' }}>
                      {strokes.map(s => (
                        <Path key={s.id} d={getPathData(s.points)} stroke="#00FF00" strokeWidth={s.size} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      ))}
                    </Svg>
                  </View>
                </ViewShot>
                {/* Lớp overlay không bắt event, chỉ để hiển thị hướng dẫn */}
                <View style={{...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center'}} pointerEvents="none">
                  <Feather name="edit-3" size={40} color="#fff" />
                  <Text style={{color: '#fff', marginTop: 12, fontWeight: 'bold'}}>Chạm để vẽ vùng chỉnh sửa</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.uploadPlaceholder} onPress={pickImage}>
                <Feather name="upload-cloud" size={40} color="#9CA3AF" />
                <Text style={styles.uploadText}>Chọn ảnh mặt bằng cần chỉnh sửa</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tools */}
          {imageUri && !resultUrl && (
            <View style={styles.toolsRow}>
              <TouchableOpacity style={styles.toolBtn} onPress={() => setIsDrawingMode(true)}>
                <Feather name="edit-3" size={20} color="#00A67E" />
                <Text style={[styles.toolText, { color: '#00A67E' }]}>Vẽ vùng chọn</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={pickImage}>
                <Feather name="image" size={20} color="#4B5563" />
                <Text style={styles.toolText}>Đổi ảnh khác</Text>
              </TouchableOpacity>
            </View>
          )}

          {resultUrl && (
            <View style={styles.toolsRow}>
              <TouchableOpacity style={styles.toolBtn} onPress={() => { setResultUrl(null); setStrokes([]); }}>
                <Feather name="edit-2" size={20} color="#00A67E" />
                <Text style={[styles.toolText, { color: '#00A67E' }]}>Sửa tiếp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={() => { setResultUrl(null); setImageUri(null); }}>
                <Feather name="plus-square" size={20} color="#4B5563" />
                <Text style={styles.toolText}>Tạo mới</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={handleSaveImage} disabled={isSaving}>
                {isSaving ? <ActivityIndicator size="small" color="#2563EB" /> : <Feather name="download" size={20} color="#2563EB" />}
                <Text style={[styles.toolText, { color: '#2563EB' }]}>Lưu ảnh</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.formContainer}>
            {/* Object Image (Optional) */}
            <TouchableOpacity style={styles.objectUploadBtn} onPress={pickObjectImage}>
              <Feather name={objectImageUri ? "check-circle" : "box"} size={20} color={objectImageUri ? "#00A67E" : "#6B7280"} />
              <Text style={[styles.objectUploadText, objectImageUri && { color: '#00A67E' }]}>
                {objectImageUri ? 'Đã chọn ảnh vật thể (Object)' : 'Chọn ảnh vật thể (Không bắt buộc)'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>Prompt AI</Text>
            <TextInput
              style={styles.input}
              placeholder="VD: Thêm một chiếc bàn gỗ phong cách minimalism vào vùng trống..."
              multiline
              value={prompt}
              onChangeText={setPrompt}
            />

            <TouchableOpacity 
              style={[styles.submitBtn, (isProcessing || !imageUri) && { opacity: 0.7 }]} 
              onPress={handleGenerate} 
              disabled={isProcessing || !imageUri || !!resultUrl}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="zap" size={20} color="#fff" />
                  <Text style={styles.submitText}>
                    {resultUrl ? 'Đã tạo ảnh' : 'Tạo ảnh AI'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNavBar active="ai" style={{ paddingBottom: insets.bottom, height: 60 + insets.bottom, position: 'absolute', bottom: 0, width: '100%' }} />

      {/* DRAWING MODAL */}
      <Modal visible={isDrawingMode} animationType="slide" transparent={false} onRequestClose={() => setIsDrawingMode(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 20 }}>
            <TouchableOpacity onPress={() => setIsDrawingMode(false)}>
              <Feather name="x" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsDrawingMode(false)}>
              <Feather name="check" size={28} color="#00A67E" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: imageSize.width, height: imageSize.height }} {...panResponder.panHandlers}>
              <Image source={{ uri: imageUri! }} style={{ width: '100%', height: '100%', position: 'absolute' }} />
              <Svg style={{ width: '100%', height: '100%', position: 'absolute' }}>
                {strokes.map(s => (
                  <Path key={s.id} d={getPathData(s.points)} stroke="#00FF00" strokeWidth={s.size} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ))}
                {currentStroke && (
                  <Path d={getPathData(currentStroke.points)} stroke="#00FF00" strokeWidth={currentStroke.size} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                )}
              </Svg>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingBottom: insets.bottom + 20 }}>
            <TouchableOpacity style={styles.toolBtn} onPress={handleUndo}>
              <Feather name="corner-up-left" size={24} color="#fff" />
              <Text style={{color: '#fff', fontSize: 12, marginTop: 4}}>Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={handleClear}>
              <Feather name="trash-2" size={24} color="#EF4444" />
              <Text style={{color: '#EF4444', fontSize: 12, marginTop: 4}}>Xóa vẽ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0D1117',
    borderBottomWidth: 1, borderBottomColor: '#0D1117'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  historyBtn: { position: 'absolute', right: 16 },
  walletContainer: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  walletText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  workspace: {
    width: SCREEN_WIDTH,
    minHeight: SCREEN_WIDTH,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  uploadPlaceholder: {
    width: '100%', height: SCREEN_WIDTH, justifyContent: 'center', alignItems: 'center',
    borderStyle: 'dashed', borderWidth: 2, borderColor: '#D1D5DB'
  },
  uploadText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
  toolsRow: { flexDirection: 'row', justifyContent: 'space-around', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E5E7EB' },
  toolBtn: { alignItems: 'center', justifyContent: 'center', padding: 8, gap: 4 },
  toolText: { fontSize: 12, color: '#4B5563', marginTop: 4 },
  formContainer: { padding: 16, backgroundColor: '#F3F4F6', flex: 1 },
  objectUploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed'
  },
  objectUploadText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12, minHeight: 100,
    textAlignVertical: 'top', borderWidth: 1, borderColor: '#D1D5DB', marginBottom: 16
  },
  submitBtn: {
    backgroundColor: '#00A67E', paddingVertical: 14, borderRadius: 8,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
