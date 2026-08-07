import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert, Keyboard } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { HubConnectionBuilder, LogLevel, HubConnection } from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNavBar } from '@/components/BottomNavBar';

// ============================================================================
// LOGIC SIGNALR TRONG FILE NÀY BÁM SÁT 1:1 THEO BẢN WEB (FloatingChat.tsx)
// ĐANG CHẠY ỔN ĐỊNH TRÊN PRODUCTION. KHÔNG THÊM CÁC NHÁNH XỬ LÝ "TỰ TẠO
// CONNECTION MỚI KHI GỬI" NHƯ CÁC BẢN TRƯỚC - VÌ BẢN WEB KHÔNG CẦN VÀ
// KHÔNG CÓ ĐOẠN ĐÓ, GIỮ NGUYÊN CHO ĐỒNG NHẤT ĐỂ DỄ SO SÁNH DEBUG SAU NÀY.
// ============================================================================

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [view, setView] = useState<'LIST' | 'CHAT'>('LIST');
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connection, setConnection] = useState<HubConnection | null>(null);

  // Ref giữ connection hiện tại, dùng trong các hàm nằm ngoài closure của
  // useEffect khởi tạo (giống hệt cách bản web dùng connectionRef).
  const connectionRef = useRef<HubConnection | null>(null);

  // Theo dõi các phòng đã Join qua SignalR để tránh gọi JoinConversation lặp lại.
  const joinedRoomIdsRef = useRef<Set<any>>(new Set());

  const flatListRef = useRef<FlatList>(null);

  // Dùng ref để luôn đọc được activeChat mới nhất bên trong callback
  // "ReceiveNewMessage" (callback này được đăng ký 1 lần lúc mount effect).
  const activeChatRef = useRef<any>(null);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    const loadAuthData = async () => {
      const uid = await AsyncStorage.getItem('current_user_id');
      const tk = await AsyncStorage.getItem('portal_token');
      setCurrentUserId(uid);
      setToken(tk);
    };
    loadAuthData();
  }, []);

  const getOtherPersonName = (room: any) => {
    if (!room) return 'Khách';
    const nameFromRoom =
      room.lesseeUserName || room.LesseeUserName ||
      room.lessorUserName || room.LessorUserName ||
      room.lesseeName || room.LesseeName ||
      room.lessorName || room.LessorName;
    if (nameFromRoom) return nameFromRoom;
    const rLessorId = room.lessorId || room.LessorId;
    return String(rLessorId) === String(currentUserId) ? "Khách thuê" : "Chủ nhà";
  };

  const isLessor = activeChat && (String(activeChat.lessorId) === String(currentUserId) || String(activeChat.LessorId) === String(currentUserId));


  // HÀM DÙNG CHUNG: fetch lại danh sách phòng chat, cập nhật state,
  // và tự động Join (qua SignalR) các phòng nào chưa từng Join - y hệt bản web.
  const fetchAndSyncConversations = async () => {
    if (!currentUserId || !token) return;
    try {
      const res = await fetch(`https://flexi-space-capstone-project.onrender.com/api/Conversation/User/${currentUserId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'accept': '*/*' }
      });
      if (!res.ok) return;
      const myRooms: any[] = await res.json();
      setConversations(myRooms);

      const activeConnection = connectionRef.current;
      if (activeConnection) {
        for (const room of myRooms) {
          const roomId = room.id || room.Id;
          if (!joinedRoomIdsRef.current.has(roomId)) {
            try {
              await activeConnection.invoke("JoinConversation", roomId);
              joinedRoomIdsRef.current.add(roomId);
            } catch (err) {
              console.error("Lỗi Join phòng chat mới:", err);
            }
          }
        }
      }
      return myRooms;
    } catch (error) {
      console.error("Lỗi fetch danh sách hội thoại:", error);
    }
  };

  useEffect(() => {
    if (!currentUserId || !token) return;
    let globalConnection: HubConnection;

    const initGlobalChat = async () => {
      try {
        const myRooms = (await fetchAndSyncConversations()) || [];

        globalConnection = new HubConnectionBuilder()
          .withUrl("https://flexi-space-capstone-project.onrender.com/chatHub", { accessTokenFactory: () => token || "" })
          .configureLogging(LogLevel.Information)
          .withAutomaticReconnect()
          .build();

        globalConnection.on("ReceiveNewMessage", (savedMessage: any) => {
          if (typeof savedMessage === 'string') return;
          const incomingRoomId = savedMessage.conversationId;
          const currentActive = activeChatRef.current;

          if (currentActive && (currentActive.id === incomingRoomId || currentActive.conversationId === incomingRoomId)) {
            setChatHistory(prev => {
              if (prev.some(m => m.id === savedMessage.id)) return prev;
              return [...prev, {
                id: savedMessage.id || Date.now(),
                senderId: savedMessage.senderId,
                text: savedMessage.content || savedMessage.message,
                time: ((d) => `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`)(new Date(savedMessage.createdAt || new Date()))
              }];
            });
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          }
        });

        globalConnection.on("ReceiveNewConversation", () => {
          fetchAndSyncConversations();
        });

        await globalConnection.start();
        for (const room of myRooms) {
          const roomId = room.id || room.Id;
          await globalConnection.invoke("JoinConversation", roomId);
          joinedRoomIdsRef.current.add(roomId);
        }
        connectionRef.current = globalConnection;
        setConnection(globalConnection);
      } catch (error) {
        console.error(error);
      }
    };
    initGlobalChat();

    return () => {
      if (globalConnection) globalConnection.stop();
      connectionRef.current = null;
      joinedRoomIdsRef.current.clear();
    };
  }, [currentUserId, token]);

  const openChatRoom = async (roomData: any) => {
    setActiveChat(roomData);
    setView('CHAT');
    setChatHistory([]);

    const roomId = roomData.conversationId || roomData.id || roomData.Id;
    if (connectionRef.current) {
      connectionRef.current.invoke("JoinConversation", roomId).catch(err => console.log(err));
    }

    try {
      const res = await fetch(`https://flexi-space-capstone-project.onrender.com/api/Message/GetMessageHistory?conversationId=${roomId}&limit=50&t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (res.ok) {
        const historyData = await res.json();
        const mappedHistory = historyData.map((msg: any) => {
          const d = new Date(msg.createdAt || msg.sentAt || new Date());
          return {
            id: msg.id, senderId: msg.senderId, text: msg.content || msg.message || '', 
            time: `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
          };
        });
        setChatHistory(mappedHistory);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Y HỆT LOGIC handleSendMessage CỦA BẢN WEB: chỉ gửi khi connection đã sẵn
  // sàng (được thiết lập từ effect global ở trên), KHÔNG tự tạo connection mới
  // ở đây. Nút gửi & ô nhập liệu đã bị disable khi !connection nên trường hợp
  // "chưa có connection" gần như không xảy ra trên UI.
  const handleSendMessage = async () => {
    const textToSend = message;
    const roomId = activeChat?.conversationId || activeChat?.id || activeChat?.Id;
    if (!textToSend.trim() || !connection || !roomId) return;

    setMessage('');
    try {
      await connection.invoke("SendMessageToGroup", roomId, textToSend);
    } catch (err) {
      console.error("Lỗi gửi tin nhắn SignalR:", err);
      Alert.alert("Lỗi", "Không thể gửi tin nhắn đi.");
    }
  };

  const renderMessageContent = (text: string, isMe: boolean) => {
    const isRevokedMessage = text.includes('❌') && text.includes('thu hồi');
    const contractRegex = /Hợp đồng \(Mã: #(\d+)\)/i;
    const match = text.match(contractRegex);

    const textColor = isMe ? '#fff' : '#111827';

    if (match && match[1] && !isRevokedMessage) {
      return (
        <View>
          <Text style={{ color: textColor, fontSize: 14, lineHeight: 20 }}>{text}</Text>
          <TouchableOpacity
            style={styles.contractBtn}
            onPress={() => router.push(`/contract/contract-details?contractId=${match[1]}`)}
          >
            <Feather name="file-text" size={14} color="#fff" />
            <Text style={styles.contractBtnText}>Xem Hợp Đồng</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <Text style={{ color: textColor, fontSize: 14, lineHeight: 20 }}>{text}</Text>;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />

      {view === 'LIST' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tin nhắn của bạn</Text>
          </View>

          <FlatList
            data={conversations}
            keyExtractor={(item, idx) => item.id?.toString() || item.Id?.toString() || idx.toString()}
            ListEmptyComponent={<Text style={styles.emptyText}>Chưa có cuộc trò chuyện nào.</Text>}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => {
              const displayName = getOtherPersonName(item);
              return (
                <TouchableOpacity style={styles.chatItem} onPress={() => openChatRoom(item)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{displayName.substring(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chatName} numberOfLines={1}>{displayName}</Text>
                    <Text style={styles.chatPreview}>Nhấp để xem tin nhắn...</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <BottomNavBar active="chat" style={{ paddingBottom: insets.bottom, height: 60 + insets.bottom }} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => { setView('LIST'); Keyboard.dismiss(); }} style={{ padding: 4 }}>
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderName}>{getOtherPersonName(activeChat)}</Text>
              <Text style={styles.chatHeaderStatus}>
                {connection ? "Đã kết nối" : "Đang kết nối..."}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            {isLessor && (
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/contract/contract-create', params: { activeChat: JSON.stringify(activeChat) } })}
                style={{ padding: 8, backgroundColor: '#00A67E', borderRadius: 8 }}
              >
                <Feather name="file-text" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            ref={flatListRef}
            data={chatHistory}
            keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isMe = String(item.senderId) === String(currentUserId);
              return (
                <View style={[styles.messageWrapper, isMe ? styles.messageMe : styles.messageOther]}>
                  <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                    {renderMessageContent(item.text, isMe)}
                  </View>
                  <Text style={styles.messageTime}>{item.time}</Text>
                </View>
              );
            }}
          />

          <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              style={styles.input}
              placeholder="Nhập tin nhắn..."
              value={message}
              onChangeText={setMessage}
              editable={!!connection}
              onSubmitEditing={() => handleSendMessage()}
              blurOnSubmit={false}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !message.trim() && { opacity: 0.5 }]}
              onPress={() => handleSendMessage()}
              disabled={!connection || !message.trim()}
            >
              <Feather name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#0D1117',
    borderBottomWidth: 1,
    borderBottomColor: '#0D1117'
  },
  backButtonList: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },

  emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
  chatItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: '#374151' },
  chatName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  chatPreview: { fontSize: 13, color: '#6B7280' },

  chatHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D1117', padding: 16, paddingBottom: 16 },
  chatHeaderInfo: { marginLeft: 12 },
  chatHeaderName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  chatHeaderStatus: { fontSize: 12, color: '#4ADE80', marginTop: 2 },
  messageList: { padding: 16 },
  messageWrapper: { marginBottom: 12, maxWidth: '80%' },
  messageMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  messageOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  messageBubble: { padding: 12, borderRadius: 16 },
  bubbleMe: { backgroundColor: '#1E293B', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  messageTime: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },

  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  input: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, marginRight: 12 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },

  contractBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, marginTop: 8, alignSelf: 'flex-start' },
  contractBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 6 }
});