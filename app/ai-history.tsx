import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Modal } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type HistoryItem = {
  id: string;
  createdAt: string;
  prompt: string;
  imageUrl: string;
  maskUrl?: string;
};

export default function AiHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // View modal state
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Save state
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      const storedToken = await AsyncStorage.getItem('portal_token');
      if (!storedToken) {
        router.replace('/login');
        return;
      }
      setToken(storedToken);

      try {
        const res = await fetch(`${API_BASE}/api/UserAiImageHistory`, {
          headers: { Authorization: `Bearer ${storedToken}`, accept: '*/*' }
        });
        if (res.ok) {
          const raw = await res.json();
          // Based on web code structure
          const data = Array.isArray(raw) ? raw : (raw.data || raw.items || raw.result || raw.userAiImageHistories || []);
          const normalized = data.map((item: any) => ({
            id: String(item.id || item.historyId || item.userAiImageHistoryId),
            createdAt: item.createdAt || item.createdDate || item.generatedAt || item.updatedAt,
            prompt: item.prompt || item.description || item.note || 'Lịch sử chỉnh ảnh',
            imageUrl: item.imageUrl || item.imageResultUrl || item.resultImageUrl || item.resultImage || item.generatedImageUrl || item.generatedImage || item.outputImageUrl || item.outputImage || '',
            maskUrl: item.maskUrl
          }));
          setHistory(normalized);
        }
      } catch (error) {
        Alert.alert('Lỗi', 'Không thể tải lịch sử ảnh.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const handleDelete = (id: string) => {
    Alert.alert('Xác nhận', 'Bạn có chắc chắn muốn xóa ảnh này khỏi lịch sử?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive', onPress: async () => {
          try {
            const res = await fetch(`${API_BASE}/api/UserAiImageHistory/${encodeURIComponent(id)}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              setHistory(prev => prev.filter(item => item.id !== id));
            } else {
              Alert.alert('Lỗi', 'Không thể xóa lịch sử này.');
            }
          } catch (e) {
            Alert.alert('Lỗi', 'Đã có lỗi xảy ra.');
          }
        }
      }
    ]);
  };

  const handleSaveImage = async (imageUrl: string) => {
    try {
      setIsSaving(true);
      
      let localUri = imageUrl;

      // Xử lý chuỗi base64 nếu thiếu tiền tố
      if (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:image')) {
        localUri = `data:image/png;base64,${imageUrl}`;
      }

      if (localUri.startsWith('http')) {
        const fileExt = localUri.split('.').pop()?.split('?')[0] || 'jpg';
        const fileUri = `${FileSystem.documentDirectory}ai_history_${Date.now()}.${fileExt}`;
        const { uri } = await FileSystem.downloadAsync(localUri, fileUri);
        localUri = uri;
      } else if (localUri.startsWith('data:image')) {
        const base64Data = localUri.split(',')[1];
        const fileUri = `${FileSystem.documentDirectory}ai_history_${Date.now()}.png`;
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

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const date = new Date(item.createdAt);
    const dateStr = !isNaN(date.getTime()) ? date.toLocaleDateString('vi-VN') : '';

    const fixImageUrl = (url: string) => {
      if (!url.startsWith('http') && !url.startsWith('data:image')) {
        return `data:image/png;base64,${url}`;
      }
      return url;
    };

    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.imageContainer} onPress={() => { setSelectedItem(item); setModalVisible(true); }}>
          <Image source={{ uri: fixImageUrl(item.imageUrl) }} style={styles.image} />
        </TouchableOpacity>
        <View style={styles.info}>
          <Text style={styles.prompt} numberOfLines={2}>{item.prompt}</Text>
          <Text style={styles.date}>{dateStr}</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
            <Feather name="trash-2" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử AI</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00A67E" />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.center}>
          <Feather name="clock" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Chưa có lịch sử chỉnh sửa ảnh.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
        />
      )}

      {/* Modal View Image */}
      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
            <Feather name="x" size={32} color="#fff" />
          </TouchableOpacity>
          {selectedItem && (
            <Image 
              source={{ uri: selectedItem.imageUrl.startsWith('http') || selectedItem.imageUrl.startsWith('data:image') ? selectedItem.imageUrl : `data:image/png;base64,${selectedItem.imageUrl}` }} 
              style={styles.modalImage} 
              resizeMode="contain"
            />
          )}
          {selectedItem && (
            <View style={styles.modalInfo}>
              <Text style={styles.modalPrompt}>{selectedItem.prompt}</Text>
              <TouchableOpacity 
                style={styles.modalSaveBtn} 
                onPress={() => handleSaveImage(selectedItem.imageUrl)}
                disabled={isSaving}
              >
                {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="download" size={20} color="#fff" />}
                <Text style={styles.modalSaveBtnText}>Lưu về máy</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0D1117',
    borderBottomWidth: 1, borderBottomColor: '#0D1117'
  },
  backBtn: { padding: 4, marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
  list: { padding: 12 },
  card: {
    width: (SCREEN_WIDTH - 36) / 2,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  imageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#E5E7EB' },
  image: { width: '100%', height: '100%' },
  info: { padding: 8 },
  prompt: { fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 4 },
  date: { fontSize: 10, color: '#9CA3AF' },
  deleteBtn: { position: 'absolute', right: 8, bottom: 8, padding: 4 },
  
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  modalImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH, backgroundColor: '#000' },
  modalInfo: { position: 'absolute', bottom: 40, width: '90%', backgroundColor: 'rgba(0,0,0,0.6)', padding: 16, borderRadius: 8 },
  modalPrompt: { color: '#fff', fontSize: 14, lineHeight: 20 },
  modalSaveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00A67E', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: 'flex-start', marginTop: 12, gap: 8 },
  modalSaveBtnText: { color: '#fff', fontWeight: 'bold' }
});
