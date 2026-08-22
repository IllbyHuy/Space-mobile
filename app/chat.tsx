import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert, Keyboard, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
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
  const [showContractOptions, setShowContractOptions] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [relatedRequests, setRelatedRequests] = useState<any[]>([]);
  const [showRequestPopup, setShowRequestPopup] = useState(false);

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

  const { conversationId, listingId } = useLocalSearchParams();
  const hasAutoOpened = useRef(false);

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
    const rLessorId = room.lessorId || room.LessorId;
    const rLesseeId = room.lesseeId || room.LesseeId;

    const currId = String(currentUserId || '').trim().toLowerCase();
    const lId = String(rLessorId || '').trim().toLowerCase();
    const lesId = String(rLesseeId || '').trim().toLowerCase();

    if (lId === currId) {
      return room.lesseeUserName || room.LesseeUserName || room.lesseeName || room.LesseeName || 'Khách thuê';
    } else if (lesId === currId) {
      return room.lessorUserName || room.LessorUserName || room.lessorName || room.LessorName || 'Chủ nhà';
    }

    return room.lesseeUserName || room.LesseeUserName ||
      room.lessorUserName || room.LessorUserName ||
      room.lesseeName || room.LesseeName ||
      room.lessorName || room.LessorName || 'Khách';
  };

  const isLessor = activeChat && (String(activeChat.lessorId || '').trim().toLowerCase() === String(currentUserId || '').trim().toLowerCase() || String(activeChat.LessorId || '').trim().toLowerCase() === String(currentUserId || '').trim().toLowerCase());


  // HÀM DÙNG CHUNG: fetch lại danh sách phòng chat, cập nhật state,
  // và tự động Join (qua SignalR) các phòng nào chưa từng Join - y hệt bản web.
  const fetchAndSyncConversations = async () => {
    if (!currentUserId || !token) return;
    try {
      const res = await fetch(`https://flexi-space-capstone-project.onrender.com/api/Conversation/User/${currentUserId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'accept': '*/*' }
      });
      if (!res.ok) return;
      let myRooms: any[] = await res.json();
      
      // Fetch latest message history for each room to show preview
      myRooms = await Promise.all(myRooms.map(async (room) => {
        const roomId = room.id || room.Id;
        try {
          const histRes = await fetch(`https://flexi-space-capstone-project.onrender.com/api/Message/GetMessageHistory?conversationId=${roomId}&limit=1`, {
            headers: { 'Authorization': `Bearer ${token}`, 'accept': '*/*' }
          });
          if (histRes.ok) {
            const histData = await histRes.json();
            if (histData && histData.length > 0) {
              const latest = histData[0];
              // Format system messages or normal text
              let content = latest.content || latest.message || "";
              if (/^\d+$/.test(content.trim())) {
                content = `📄 Đã gửi hợp đồng #${content.trim()}`;
              }
              room.lastMessageContent = content;
              room.lastMessageTime = latest.createdAt || latest.sentAt || room.lastMessage;
            }
          }
        } catch (e) {
          console.log("Error fetching history for room", roomId, e);
        }
        return room;
      }));

      const sortedRooms = myRooms.sort((a, b) => new Date(b.lastMessageTime || b.lastMessage).getTime() - new Date(a.lastMessageTime || a.lastMessage).getTime());
      setConversations(sortedRooms);

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
          
          // Update the list view
          setConversations(prev => {
            const index = prev.findIndex(c => c.id === incomingRoomId || c.Id === incomingRoomId);
            if (index !== -1) {
              const updatedRoom = { ...prev[index] };
              let content = savedMessage.content || savedMessage.message || "";
              if (/^\d+$/.test(content.trim())) {
                content = `📄 Đã gửi hợp đồng #${content.trim()}`;
              }
              updatedRoom.lastMessageContent = content;
              updatedRoom.lastMessageTime = savedMessage.createdAt || new Date().toISOString();
              if (String(savedMessage.senderId) !== String(currentUserId)) {
                  updatedRoom.unreadCount = (updatedRoom.unreadCount || 0) + 1;
              }
              const newConversations = [...prev];
              newConversations.splice(index, 1);
              newConversations.unshift(updatedRoom);
              return newConversations;
            }
            return prev;
          });

          const currentActive = activeChatRef.current;
          if (currentActive && (currentActive.id === incomingRoomId || currentActive.conversationId === incomingRoomId)) {
            // Đang mở phòng chat này, báo đã xem
            globalConnection.invoke("MarkConversationAsRead", incomingRoomId, currentUserId).catch(err => console.log(err));

            setChatHistory(prev => {
              if (prev.some(m => m.id === savedMessage.id)) return prev;
              return [...prev, {
                id: savedMessage.id || Date.now(),
                senderId: savedMessage.senderId,
                text: savedMessage.content || savedMessage.message,
                time: ((d) => `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`)(new Date(savedMessage.createdAt || new Date())),
                isRead: savedMessage.isRead || false
              }];
            });
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          }
        });

        globalConnection.on("ReceiveReadReceipt", (receipt: any) => {
          const currentActive = activeChatRef.current;
          if (currentActive && (currentActive.id === receipt.conversationId || currentActive.conversationId === receipt.conversationId)) {
            // Nếu người kia đọc, cập nhật tin nhắn của mình thành đã xem
            if (String(receipt.userId) !== String(currentUserId)) {
              setChatHistory(prev => prev.map(m => {
                if (String(m.senderId) === String(currentUserId)) {
                  return { ...m, isRead: true };
                }
                return m;
              }));
            }
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
      } catch (error: any) {
        console.log("Chat connection failed:", error?.message || error);
        const errStr = String(error?.message || error);
        if (errStr.includes("401") && (global as any).reloginTrick) {
          console.log("Chat detected 401, trying trick relogin...");
          const newToken = await (global as any).reloginTrick();
          if (newToken) {
            setToken(newToken); // Update state to trigger useEffect re-run with new token
          } else {
             // If trick fails, redirect to login
             AsyncStorage.multiRemove(['portal_token', 'portal_email', 'portal_password', 'current_user_id']);
             router.replace('/login');
          }
        }
      }
    };
    initGlobalChat();

    return () => {
      if (globalConnection) {
        try {
          globalConnection.stop().catch((e) => console.log('Stop connection error:', e));
        } catch (error) {
          console.log('Sync stop error:', error);
        }
      }
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
      // Báo đã xem khi mở phòng
      connectionRef.current.invoke("MarkConversationAsRead", roomId, currentUserId).catch(err => console.log(err));
    }
    
    // Cập nhật local state unreadCount về 0
    setConversations(prev => {
      const idx = prev.findIndex(c => String(c.id) === String(roomId) || String(c.Id) === String(roomId));
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], unreadCount: 0, UnreadCount: 0 };
        return updated;
      }
      return prev;
    });

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
            time: `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`,
            isRead: msg.isRead
          };
        });
        setChatHistory(mappedHistory);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (conversationId && conversations.length > 0 && view === 'LIST' && !hasAutoOpened.current) {
      const room = conversations.find(c => String(c.id || c.Id) === String(conversationId));
      if (room) {
        hasAutoOpened.current = true;
        openChatRoom(room);
      }
    }
  }, [conversationId, conversations, view]);

  // Fetch Booking Requests related to activeChat
  useEffect(() => {
    if (activeChat && view === 'CHAT') {
      const fetchReqs = async () => {
        try {
          const otherId = isLessor ? activeChat?.lesseeId || activeChat?.LesseeId : activeChat?.lessorId || activeChat?.LessorId;
          const [reqRes1, reqRes2, spaceRes, listingRes] = await Promise.all([
            fetch(`https://flexi-space-capstone-project.onrender.com/api/PrimaryBookingRequest/GetAll?status=1`, { headers: { 'Authorization': `Bearer ${token}`, 'accept': '*/*' } }),
            fetch(`https://flexi-space-capstone-project.onrender.com/api/PrimaryBookingRequest/GetAll?status=2`, { headers: { 'Authorization': `Bearer ${token}`, 'accept': '*/*' } }),
            fetch(`https://flexi-space-capstone-project.onrender.com/api/Space/GetAll`, { headers: { 'accept': '*/*' } }),
            fetch(`https://flexi-space-capstone-project.onrender.com/api/Listing/GetAll`, { headers: { 'accept': '*/*' } })
          ]);
          
          if (reqRes1.ok || reqRes2.ok) {
            const data1 = reqRes1.ok ? await reqRes1.json() : [];
            const data2 = reqRes2.ok ? await reqRes2.json() : [];
            const safeData = [...(Array.isArray(data1) ? data1 : data1?.data || data1?.items || []), ...(Array.isArray(data2) ? data2 : data2?.data || data2?.items || [])];
            
            const spaceData = spaceRes.ok ? await spaceRes.json() : [];
            const listingData = listingRes.ok ? await listingRes.json() : [];
            const spaces = Array.isArray(spaceData) ? spaceData : spaceData?.data || spaceData?.items || [];
            const listings = Array.isArray(listingData) ? listingData : listingData?.data || listingData?.items || [];
            
            const reqs = safeData.filter((r: any) => 
              r.spaceId && r.listingId &&
              ((String(r.lessorId) === String(currentUserId) && String(r.lesseeId) === String(otherId)) ||
               (String(r.lessorId) === String(otherId) && String(r.lesseeId) === String(currentUserId)))
            ).map((r: any) => {
              const space = spaces.find((s: any) => String(s.id || s.Id) === String(r.spaceId));
              const listing = listings.find((l: any) => String(l.id || l.Id) === String(r.listingId));
              return {
                ...r,
                spaceName: space?.name || space?.Name || 'Không xác định',
                listingName: listing?.name || listing?.Name || 'Không xác định'
              };
            });
            setRelatedRequests(reqs);
          }
        } catch(e) {}
      };
      fetchReqs();
    }
  }, [activeChat, view, token, currentUserId, isLessor]);

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
    const isOnlyNumber = /^\d+$/.test(text.trim());

    const textColor = isMe ? '#fff' : '#111827';
    let contractId = null;
    let displayText = text;

    if (!isRevokedMessage) {
      if (isOnlyNumber) {
        contractId = text.trim();
        displayText = `📄 Tôi vừa tạo và gửi một Hợp đồng (Mã: #${contractId}). Vui lòng kiểm tra và xác nhận nhé!`;
      } else if (match && match[1]) {
        contractId = match[1];
      }
    }

    if (contractId) {
      return (
        <View>
          <Text style={{ color: textColor, fontSize: 14, lineHeight: 20 }}>{displayText}</Text>
          <TouchableOpacity
            style={styles.contractBtn}
            onPress={() => router.push(`/contract/contract-details?contractId=${contractId}`)}
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
              const previewText = item.lastMessageContent || "Nhấp để xem tin nhắn...";
              const isUnread = item.unreadCount > 0;
              
              let timeString = "";
              if (item.lastMessageTime || item.lastMessage) {
                const d = new Date(item.lastMessageTime || item.lastMessage);
                const isToday = d.toLocaleDateString() === new Date().toLocaleDateString();
                timeString = isToday 
                  ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) 
                  : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
              }

              return (
                <TouchableOpacity style={styles.chatItem} onPress={() => openChatRoom(item)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{displayName.substring(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={[styles.chatName, isUnread && { fontWeight: 'bold' }, { flex: 1, marginBottom: 0 }]} numberOfLines={1}>{displayName}</Text>
                      {timeString ? <Text style={{ fontSize: 12, color: isUnread ? '#10B981' : '#9CA3AF', fontWeight: isUnread ? 'bold' : 'normal' }}>{timeString}</Text> : null}
                    </View>
                    <Text style={[styles.chatPreview, isUnread && { fontWeight: 'bold', color: '#000' }]} numberOfLines={1}>{previewText}</Text>
                  </View>
                  {isUnread && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                    </View>
                  )}
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
            <TouchableOpacity style={styles.chatHeaderInfo} onPress={() => {
              const otherId = activeChat.ParticipantIds?.find((id: string) => id !== currentUserId) || activeChat.LessorId || activeChat.lessorId || activeChat.LesseeId || activeChat.lesseeId;
              if (otherId) router.push(`/public-profile/${otherId}` as any);
            }}>
              <Text style={styles.chatHeaderName}>{getOtherPersonName(activeChat)}</Text>
              <Text style={styles.chatHeaderStatus}>
                {connection ? "Đã kết nối" : "Đang kết nối..."}
              </Text>
            </TouchableOpacity>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 8 }}>
              <TouchableOpacity onPress={() => setShowRequestPopup(true)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, marginRight: 8 }}>
                <Feather name="info" size={20} color="#fff" />
              </TouchableOpacity>
              {!isLessor && (listingId || activeChat?.listingId || activeChat?.ListingId) ? (
                <TouchableOpacity
                  onPress={() => {
                    const targetListingId = listingId || activeChat?.listingId || activeChat?.ListingId;
                    router.push(`/listing/${targetListingId}?openBooking=true` as any);
                  }}
                  style={{ padding: 8, backgroundColor: '#3b82f6', borderRadius: 8, marginRight: 8 }}
                >
                  <Feather name="clipboard" size={20} color="#fff" />
                </TouchableOpacity>
              ) : null}
              {isLessor && (
                <TouchableOpacity
                  onPress={() => setShowContractOptions(true)}
                  style={{ padding: 8, backgroundColor: '#00A67E', borderRadius: 8 }}
                >
                  <Feather name="file-text" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {showRequestPopup && (
            <View style={{ padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', maxHeight: 200 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#1E293B' }}>Yêu cầu thuê liên quan</Text>
                <TouchableOpacity onPress={() => setShowRequestPopup(false)}>
                  <Feather name="x" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
              {relatedRequests.length === 0 ? (
                <Text style={{ color: '#64748B', textAlign: 'center' }}>Không có yêu cầu thuê nào.</Text>
              ) : (
                <FlatList
                  data={relatedRequests}
                  keyExtractor={item => item.id?.toString()}
                  renderItem={({ item }) => (
                    <View style={{ padding: 12, backgroundColor: '#F8FAFC', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <Text style={{ fontWeight: 'bold', color: '#0F172A', marginBottom: 4 }}>Mã yêu cầu: #{item.id}</Text>
                      <Text style={{ color: '#334155', marginBottom: 2 }}>Tin đăng: {item.listingName}</Text>
                      <Text style={{ color: '#334155', marginBottom: 2 }}>Mặt bằng: {item.spaceName}</Text>
                      <Text style={{ color: '#334155', marginBottom: 2 }}>
                        Thời gian: {item.expectedStartDate ? new Date(item.expectedStartDate).toLocaleDateString('vi-VN') : '?'} - {item.expectedEndDate ? new Date(item.expectedEndDate).toLocaleDateString('vi-VN') : '?'}
                      </Text>
                      <Text style={{ color: '#334155', marginBottom: 2 }}>
                        Giá đề xuất: {item.offeredPrice ? item.offeredPrice.toLocaleString('vi-VN') + ' VNĐ/tháng' : 'Thỏa thuận'}
                      </Text>
                    </View>
                  )}
                />
              )}
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={chatHistory}
            keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isOnlyNumber = /^\d+$/.test(item.text.trim());
              const isSystemMessage = isOnlyNumber || item.text.includes('Tôi vừa tạo và gửi một Hợp đồng') || item.text.includes('Chủ mặt bằng đã xác nhận hợp đồng') || item.text.includes('Khách thuê đã ký') || item.text.includes('thu hồi Hợp đồng') || item.text.includes('vừa cập nhật Hợp đồng') || item.text.includes('[HỢP ĐỒNG MỚI]') || item.text.includes('Hợp đồng ngoài hệ thống đã được cả hai bên xác nhận và kích hoạt') || item.text.includes('Hợp đồng (Mã:');
              const isMe = String(item.senderId) === String(currentUserId);
              
              if (isSystemMessage) {
                return (
                  <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, maxWidth: '80%' }}>
                      {renderMessageContent(item.text, false)}
                    </View>
                    <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{item.time}</Text>
                  </View>
                );
              }

              return (
                <View style={[styles.messageWrapper, isMe ? styles.messageMe : styles.messageOther]}>
                  <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                    {renderMessageContent(item.text, isMe)}
                  </View>
                  <Text style={styles.messageTime}>
                    {item.time}
                    {isMe && item.isRead && (
                      <Text style={{ color: '#10B981', fontWeight: 'bold' }}>  ✓ Đã xem</Text>
                    )}
                  </Text>
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

          <Modal visible={showContractOptions} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Tùy chọn tạo hợp đồng</Text>
                
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                  onPress={() => {
                    setShowContractOptions(false);
                    router.push({ pathname: '/contract/contract-create', params: { activeChat: JSON.stringify(activeChat) } });
                  }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5f6f1', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Feather name="file-text" size={20} color="#00A67E" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Tạo hợp đồng trực tuyến</Text>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>Điền thông tin và ký điện tử ngay trên app</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }}
                  onPress={() => {
                    setShowContractOptions(false);
                    router.push({ pathname: '/contract/external-contract-create', params: { activeChat: JSON.stringify(activeChat) } });
                  }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Feather name="upload" size={20} color="#4b5563" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Tải ảnh hợp đồng giấy</Text>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>Dành cho hợp đồng đã ký bên ngoài</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ marginTop: 20, padding: 14, backgroundColor: '#f3f4f6', borderRadius: 8, alignItems: 'center' }}
                  onPress={() => setShowContractOptions(false)}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>Hủy</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

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
  contractBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
  unreadBadge: {
    backgroundColor: '#ff3b30',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});