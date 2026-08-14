import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const API_BASE = "https://flexi-space-capstone-project.onrender.com";

export default function BookingRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<any[]>([]);
  const [listingsById, setListingsById] = useState<Record<number, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadAuth = async () => {
      const tk = await AsyncStorage.getItem("portal_token");
      const uid = await AsyncStorage.getItem("current_user_id");
      setToken(tk);
      setCurrentUserId(uid);
    };
    loadAuth();
  }, []);

  useEffect(() => {
    if (token && currentUserId) {
      fetchRequests();
    }
  }, [token, currentUserId]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/PrimaryBookingRequest/GetAll?status=Pending`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        const safeData = Array.isArray(data)
          ? data
          : data?.data || data?.items || [];
        const myRequests = safeData.filter(
          (req: any) => String(req.lessorId) === String(currentUserId),
        );
        setRequests(myRequests);

        const uniqueListingIds = Array.from(
          new Set(myRequests.map((r: any) => r.listingId).filter(Boolean)),
        );
        const listingResults = await Promise.all(
          uniqueListingIds.map(async (listingId) => {
            try {
              const listingRes = await fetch(
                `${API_BASE}/api/Listing/${listingId}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              if (!listingRes.ok) return null;
              return { listingId, listing: await listingRes.json() };
            } catch {
              return null;
            }
          }),
        );
        const listingMap: Record<number, any> = {};
        listingResults.forEach((entry: any) => {
          if (entry) listingMap[entry.listingId] = entry.listing;
        });
        setListingsById(listingMap);
      }
    } catch (error) {
      console.error("Lỗi tải danh sách yêu cầu:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = (
    requestId: number,
    newStatus: "Approved" | "Rejected",
    lesseeId: string,
  ) => {
    if (!requestId) {
      console.warn(
        "Lỗi: Không tìm thấy ID của yêu cầu (requestId bị undefined)",
      );
      return;
    }

    if (Platform.OS === "web") {
      const confirmMsg = `Bạn có chắc muốn ${newStatus === "Approved" ? "DUYỆT" : "TỪ CHỐI"} yêu cầu này?`;
      if (window.confirm(confirmMsg)) {
        updateStatusApi(requestId, newStatus, lesseeId);
      }
      return;
    }

    Alert.alert(
      "Xác nhận",
      `Bạn có chắc muốn ${newStatus === "Approved" ? "DUYỆT" : "TỪ CHỐI"} yêu cầu này?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đồng ý",
          onPress: () => updateStatusApi(requestId, newStatus, lesseeId),
          style: newStatus === "Approved" ? "default" : "destructive",
        },
      ],
    );
  };

  const updateStatusApi = async (
    requestId: number,
    newStatus: "Approved" | "Rejected",
    lesseeId: string,
  ) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/PrimaryBookingRequest/Status/${requestId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!res.ok) {
        Alert.alert("Lỗi", "Lỗi khi cập nhật trạng thái đơn!");
        return;
      }

      if (newStatus === "Approved" && lesseeId) {
        try {
          const convRes = await fetch(
            `${API_BASE}/api/Conversation/Create?lessorId=${currentUserId}&lesseeId=${lesseeId}`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          if (convRes.ok) {
            if (Platform.OS === "web")
              window.alert(
                "Đã duyệt đơn và tạo phòng chat thành công! Khách thuê giờ đã có thể nhắn tin cho bạn.",
              );
            else
              Alert.alert(
                "Thành công",
                "Đã duyệt đơn và tạo phòng chat thành công! Khách thuê giờ đã có thể nhắn tin cho bạn.",
              );
          } else {
            if (Platform.OS === "web")
              window.alert(
                "Đã duyệt đơn nhưng không thể tạo phòng chat tự động.",
              );
            else
              Alert.alert(
                "Thông báo",
                "Đã duyệt đơn nhưng không thể tạo phòng chat tự động.",
              );
          }
        } catch (chatErr) {
          console.error("Lỗi tạo phòng chat:", chatErr);
          if (Platform.OS === "web")
            window.alert(
              "Đã duyệt đơn nhưng không thể tạo phòng chat tự động.",
            );
          else
            Alert.alert(
              "Thông báo",
              "Đã duyệt đơn nhưng không thể tạo phòng chat tự động.",
            );
        }
      } else {
        if (Platform.OS === "web")
          window.alert(
            newStatus === "Approved"
              ? "Đã duyệt thành công!"
              : "Đã từ chối yêu cầu thuê!",
          );
        else
          Alert.alert(
            "Thành công",
            newStatus === "Approved"
              ? "Đã duyệt thành công!"
              : "Đã từ chối yêu cầu thuê!",
          );
      }

      fetchRequests();
    } catch (error) {
      console.error("Lỗi cập nhật:", error);
      Alert.alert("Lỗi", "Lỗi kết nối máy chủ!");
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const listing = listingsById[item.listingId];
    const pic = listing?.listingPictures?.[0] || listing?.pictures?.[0];
    const listingImage = pic?.imageUrl || pic?.url || pic?.pictureUrl || "https://images.unsplash.com/photo-1556761175-5973dc0f32d7?auto=format&fit=crop&q=80&w=800";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.requestDate}>
            {new Date(item.expectedStartDate).toLocaleDateString("vi-VN")} -{" "}
            {new Date(item.expectedEndDate).toLocaleDateString("vi-VN")}
          </Text>
        </View>

        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 16,
          }}
          onPress={() => router.push(`/listing/${item.listingId}` as any)}
        >
          {listingImage ? (
            <Image
              source={{ uri: listingImage }}
              style={{
                width: 50,
                height: 50,
                borderRadius: 8,
                marginRight: 12,
              }}
            />
          ) : (
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 8,
                marginRight: 12,
                backgroundColor: "#E5E7EB",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="image" size={20} color="#9CA3AF" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontWeight: "bold", fontSize: 16, color: "#111827" }}
              numberOfLines={1}
            >
              {listing?.name || `Mã tin: #${item.listingId}`}
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 13 }} numberOfLines={1}>
              Nhấn để xem tin đăng
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.cardBody}>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Người thuê:</Text>{" "}
            {item.lesseeName || "Không rõ"}
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Giá đề xuất:</Text>{" "}
            {item.offeredPrice
              ? `${item.offeredPrice.toLocaleString("vi-VN")} VND`
              : "Thỏa thuận"}
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Mục đích:</Text>{" "}
            {item.purpose || "Không có"}
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Thời lượng:</Text> {item.duration || 1}{" "}
            ngày
          </Text>
          {item.note && (
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Ghi chú:</Text> {item.note}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.rejectBtn]}
            onPress={() =>
              handleUpdateStatus(
                item.id || item.Id,
                "Rejected",
                item.lesseeId || item.LesseeId,
              )
            }
          >
            <Feather name="x-circle" size={18} color="#EF4444" />
            <Text style={styles.rejectBtnText}>Từ chối</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.approveBtn]}
            onPress={() =>
              handleUpdateStatus(
                item.id || item.Id,
                "Approved",
                item.lesseeId || item.LesseeId,
              )
            }
          >
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.approveBtnText}>Duyệt</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: "#0D1117" }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yêu cầu thuê</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00A67E" />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <Feather name="inbox" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>
            Không có yêu cầu thuê nào đang chờ duyệt
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0D1117",
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  requestTitle: { fontSize: 16, fontWeight: "bold", color: "#111827" },
  requestDate: { fontSize: 12, color: "#6B7280" },
  cardBody: { marginBottom: 16 },
  infoText: { fontSize: 14, color: "#374151", marginBottom: 4 },
  bold: { fontWeight: "bold", color: "#111827" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  rejectBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  rejectBtnText: { color: "#EF4444", fontWeight: "bold" },
  approveBtn: { backgroundColor: "#00A67E" },
  approveBtnText: { color: "#fff", fontWeight: "bold" },
});
