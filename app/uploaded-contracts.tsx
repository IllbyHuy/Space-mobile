import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, Image, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = 'https://flexi-space-capstone-project.onrender.com';

export default function UploadedContractsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed'>('pending');
  const [viewingContract, setViewingContract] = useState<any>(null);
  
  const [spaceNames, setSpaceNames] = useState<Map<string, string>>(new Map());
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const fetchContracts = async () => {
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('portal_token');
      const storedId = await AsyncStorage.getItem('current_user_id');
      if (!token || !storedId) {
        setIsLoading(false);
        return;
      }
      setCurrentUserId(storedId);
      
      const [asLessorRes, asLesseeRes] = await Promise.all([
        fetch(`${API_BASE}/api/Contract/GetAll?LessorId=${storedId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/Contract/GetAll?LesseeId=${storedId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const dataLessor = asLessorRes.ok ? await asLessorRes.json() : [];
      const dataLessee = asLesseeRes.ok ? await asLesseeRes.json() : [];

      const asLessor = dataLessor?.data || dataLessor?.items || dataLessor || [];
      const asLessee = dataLessee?.data || dataLessee?.items || dataLessee || [];

      const map = new Map<string, any>();
      const normalize = (data: any) => Array.isArray(data) ? data : (data?.data || data?.items || []);
      
      [...normalize(asLessor), ...normalize(asLessee)].forEach((c: any) => {
        const source = c.source || c.Source;
        if (source === 'External') {
          map.set(String(c.id ?? c.Id), c);
        }
      });

      const myContracts = Array.from(map.values()).sort((a: any, b: any) => {
        const idA = Number(a.id ?? a.Id ?? 0);
        const idB = Number(b.id ?? b.Id ?? 0);
        return idB - idA;
      });
      
      setContracts(myContracts);

      // Fetch space names
      try {
        const spaceRes = await fetch(`${API_BASE}/api/Space/GetAll`, { headers: { Authorization: `Bearer ${token}` }});
        if (spaceRes.ok) {
          const spaces = await spaceRes.json();
          const sList = Array.isArray(spaces) ? spaces : (spaces?.data || spaces?.items || []);
          const sMap = new Map<string, string>();
          sList.forEach((s: any) => sMap.set(String(s.id || s.Id), s.name || s.Name));
          setSpaceNames(sMap);
        }
      } catch (err) {
        console.error('Space fetch err', err);
      }

      // Fetch user names
      try {
        const uniqueUserIds = new Set<string>();
        myContracts.forEach((c: any) => {
          if (c.lessorId || c.LessorId) uniqueUserIds.add(String(c.lessorId || c.LessorId));
          if (c.lesseeId || c.LesseeId) uniqueUserIds.add(String(c.lesseeId || c.LesseeId));
        });

        const uMap = new Map<string, string>();
        await Promise.all(Array.from(uniqueUserIds).map(async (uId) => {
          const pRes = await fetch(`${API_BASE}/api/User/${uId}`, { headers: { Authorization: `Bearer ${token}` }});
          if (pRes.ok) {
            const profile = await pRes.json();
            uMap.set(uId, profile.fullName || profile.userName || profile.FullName || profile.UserName || 'Unknown');
          }
        }));
        setUserNames(uMap);
      } catch(err) {
        console.error('User fetch err', err);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const handleConfirm = async (contractId: string | number) => {
    const token = await AsyncStorage.getItem('portal_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/ExternalContract/${contractId}/Confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        Alert.alert('Thành công', 'Đã xác nhận hợp đồng thành công!');
        setViewingContract(null);
        fetchContracts();
      } else {
        const err = await res.text();
        Alert.alert('Lỗi', err);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Đã xảy ra lỗi khi xác nhận.');
    }
  };

  const isConfirmed = (c: any) => {
    const status = c.status || c.Status;
    return status === 'Confirmed' || status === 'Active' || c.isConfirmed === true || c.isActive === true;
  };

  const filteredContracts = contracts.filter(c => 
    activeTab === 'confirmed' ? isConfirmed(c) : !isConfirmed(c)
  );

  const getContractStatusBadge = (c: any) => {
    if (isConfirmed(c)) return <View style={[styles.badge, { backgroundColor: '#e5f6f1' }]}><Text style={{ color: '#00A67E', fontSize: 12, fontWeight: 'bold' }}>Đã xác nhận</Text></View>;
    return <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}><Text style={{ color: '#d97706', fontSize: 12, fontWeight: 'bold' }}>Chờ xác nhận</Text></View>;
  };

  const renderContract = ({ item }: { item: any }) => {
    const sId = String(item.spaceId || item.SpaceId);
    const spaceName = spaceNames.get(sId) || `Mặt bằng #${sId}`;
    
    const isMyRoleLessor = String(item.lessorId || item.LessorId) === currentUserId;
    const otherId = isMyRoleLessor ? String(item.lesseeId || item.LesseeId) : String(item.lessorId || item.LessorId);
    const roleText = isMyRoleLessor ? 'Cho thuê' : 'Đi thuê';
    const otherName = userNames.get(otherId) || 'Unknown';
    const cId = item.id || item.Id;

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => setViewingContract(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Hợp đồng #{cId}</Text>
          {getContractStatusBadge(item)}
        </View>
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={16} color="#6b7280" />
            <Text style={styles.infoText}>{spaceName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="user" size={16} color="#6b7280" />
            <Text style={styles.infoText}>Đối tác: <Text style={{ fontWeight: 'bold' }}>{otherName}</Text></Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="tag" size={16} color="#6b7280" />
            <Text style={styles.infoText}>Vai trò: {roleText}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hợp đồng tải lên</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Chờ xác nhận</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'confirmed' && styles.activeTab]}
          onPress={() => setActiveTab('confirmed')}
        >
          <Text style={[styles.tabText, activeTab === 'confirmed' && styles.activeTabText]}>Đã xác nhận</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00A67E" />
        </View>
      ) : (
        <FlatList
          data={filteredContracts}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderContract}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="file-text" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>Không có hợp đồng nào</Text>
            </View>
          }
        />
      )}

      {/* Viewing Modal */}
      <Modal visible={!!viewingContract} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết Hợp đồng #{viewingContract?.id || viewingContract?.Id}</Text>
              <TouchableOpacity onPress={() => setViewingContract(null)}>
                <Feather name="x" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {(() => {
                const pics = viewingContract?.pictureURLs || viewingContract?.pictures || [];
                if (pics.length > 0) {
                  return (
                    <View style={styles.imageGrid}>
                      {pics.map((pic: any, idx: number) => {
                        const imgUrl = pic.imageUrl || pic.url || pic.Url;
                        return (
                          <View key={idx} style={styles.imageWrapper}>
                            <Image source={{ uri: imgUrl }} style={styles.contractImage} />
                          </View>
                        );
                      })}
                    </View>
                  );
                }
                return (
                  <View style={styles.noImage}>
                    <Text style={{ color: '#6b7280' }}>Không có ảnh hợp đồng đính kèm.</Text>
                  </View>
                );
              })()}

              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>Mặt bằng</Text>
                <Text style={styles.detailValue}>{spaceNames.get(String(viewingContract?.spaceId || viewingContract?.SpaceId))}</Text>
              </View>

              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>Bên cho thuê (A)</Text>
                <Text style={styles.detailValue}>{userNames.get(String(viewingContract?.lessorId || viewingContract?.LessorId))}</Text>
              </View>

              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>Bên thuê (B)</Text>
                <Text style={styles.detailValue}>{userNames.get(String(viewingContract?.lesseeId || viewingContract?.LesseeId))}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              {String(viewingContract?.lesseeId || viewingContract?.LesseeId) === currentUserId && !isConfirmed(viewingContract) && (
                <TouchableOpacity 
                  style={styles.confirmBtn}
                  onPress={() => handleConfirm(viewingContract?.id || viewingContract?.Id)}
                >
                  <Text style={styles.confirmBtnText}>Xác nhận hợp đồng</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#00A67E' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  activeTabText: { color: '#00A67E', fontWeight: 'bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContainer: { padding: 16, flexGrow: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#6b7280' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.05, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  cardBody: { gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, color: '#374151' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  imageWrapper: { width: '48%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  contractImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  noImage: { padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 24 },
  detailBox: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  detailLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff' },
  confirmBtn: { backgroundColor: '#00A67E', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
