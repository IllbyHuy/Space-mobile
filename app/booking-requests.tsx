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
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1556761175-5973dc0f32d7?auto=format&fit=crop&q=80&w=800";

// GIỐNG HỆT WEB: tìm URL ảnh theo nhiều key khác nhau
const URL_KEYS = ["imageUrl", "url", "pictureUrl", "fileUrl", "secureUrl", "publicUrl", "src", "link", "path"];
const NESTED_KEYS = ["picture", "image", "file", "media"];

function getListingPictureUrl(picture: unknown): string | null {
  if (!picture) return null;
  if (typeof picture === "string") return picture;
  if (typeof picture !== "object") return null;
  const obj = picture as Record<string, unknown>;
  for (const key of URL_KEYS) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  for (const key of NESTED_KEYS) {
    const nestedUrl = getListingPictureUrl(obj[key]);
    if (nestedUrl) return nestedUrl;
  }
  return null;
}

// GIỐNG HỆT WEB: lấy địa chỉ từ listing hoặc Space cha
function getListingAddress(listing: any, spacesById: Record<number, any>): string {
  if (!listing) return "";
  const parentSpace = spacesById[listing.spaceId ?? listing.SpaceId];
  return listing.location || listing.address || parentSpace?.address || parentSpace?.location || "";
}

export default function BookingRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<any[]>([]);
  const [listingsById, setListingsById] = useState<Record<number, any>>({});
  const [spacesById, setSpacesById] = useState<Record<number, any>>({});
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
      // GIỐNG WEB: fetch requests + spaces song song
      const [reqRes, spacesRes] = await Promise.all([
        fetch(`${API_BASE}/api/PrimaryBookingRequest/GetAll?status=Pending`, {
          headers: { Authorization: `Bearer ${token}`, accept: "*/*" },
        }),
        fetch(`${API_BASE}/api/Space/GetAll`, {
          headers: { Authorization: `Bearer ${token}`, accept: "*/*" },
        }),
      ]);

      // Build spaces map (để ghép địa chỉ)
      if (spacesRes.ok) {
        const spacesData = await spacesRes.json();
        const safeSpaces = Array.isArray(spacesData) ? spacesData : spacesData?.data || spacesData?.items || [];
        const map: Record<number, any> = {};
        safeSpaces.forEach((s: any) => {
          const id = s.id ?? s.Id;
          if (id != null) map[id] = s;
        });
        setSpacesById(map);
      }

      if (reqRes.ok) {
        const data = await reqRes.json();
        const safeData = Array.isArray(data) ? data : data?.data || data?.items || [];
        const myRequests = safeData.filter(
          (req: any) => String(req.lessorId) === String(currentUserId),
        );
        setRequests(myRequests);

        // GIỐNG WEB: fetch từng listing theo GetById (đáng tin cậy hơn GetAll)
        const uniqueListingIds = Array.from(
          new Set(myRequests.map((r: any) => r.listingId || r.ListingId).filter(Boolean))
        );
        const listingResults = await Promise.all(
          uniqueListingIds.map(async (listingId) => {
            try {
              const res = await fetch(
                `${API_BASE}/api/Listing/GetById/${listingId}`,
                { headers: { Authorization: `Bearer ${token}`, accept: "*/*" } }
              );
              if (!res.ok) return null;
              const listingData = await res.json();
              return { listingId, listing: listingData };
            } catch {
              return null;
            }
          })
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
    if (!requestId) return;
    const actionLabel = newStatus === "Approved" ? "DUYỆT" : "TỪ CHỐI";

    if (Platform.OS === "web") {
      if (window.confirm(`Bạn có chắc muốn ${actionLabel} yêu cầu này?`)) {
        updateStatusApi(requestId, newStatus, lesseeId);
      }
      return;
    }

    Alert.alert(
      "Xác nhận",
      `Bạn có chắc muốn ${actionLabel} yêu cầu này?`,
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
          await fetch(
            `${API_BASE}/api/Conversation/Create?lessorId=${currentUserId}&lesseeId=${lesseeId}`,
            { method: "POST", headers: { Authorization: `Bearer ${token}`, accept: "*/*" } },
          );
          Alert.alert("Thành công", "Đã duyệt đơn và tạo phòng chat thành công!");
        } catch {
          Alert.alert("Thông báo", "Đã duyệt đơn nhưng không thể tạo phòng chat tự động.");
        }
      } else {
        Alert.alert(
          "Thành công",
          newStatus === "Approved" ? "Đã duyệt thành công!" : "Đã từ chối yêu cầu thuê!",
        );
      }
      fetchRequests();
    } catch (error) {
      console.error("Lỗi cập nhật:", error);
      Alert.alert("Lỗi", "Lỗi kết nối máy chủ!");
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const listingId = item.listingId || item.ListingId;
    const listing = listingsById[listingId];
    const picObj = listing?.listingPictures?.[0] || listing?.pictures?.[0];
    const listingImage = getListingPictureUrl(picObj) || FALLBACK_IMAGE;
    const listingName = listing?.name || listing?.title || (listing === undefined ? "Đang tải..." : `Mặt bằng #${listingId}`);
    const listingAddress = getListingAddress(listing, spacesById);

    return (
      <View style={styles.card}>
        {/* Ảnh + tên listing — nhấn để xem chi tiết */}
        <TouchableOpacity
          style={styles.listingRow}
          activeOpacity={0.8}
          onPress={() => {
            if (listingId) router.push(`/listing/${listingId}` as any);
          }}
        >
          <Image
            source={{ uri: listingImage }}
            style={styles.listingImage}
            resizeMode="cover"
          />
          <View style={styles.listingInfo}>
            <Text style={styles.listingName} numberOfLines={2}>
              {listingName}
            </Text>
            {!!listingAddress && (
              <View style={styles.addrRow}>
                <Feather name="map-pin" size={11} color="#6B7280" />
                <Text style={styles.listingAddr} numberOfLines={1}>
                  {listingAddress}
                </Text>
              </View>
            )}
            <View style={styles.viewDetailRow}>
              <Text style={styles.viewDetailText}>Nhấn để xem tin đăng</Text>
              <Feather name="chevron-right" size={13} color="#00A67E" />
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Thông tin yêu cầu */}
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Feather name="user" size={14} color="#6B7280" />
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Người thuê: </Text>
              {item.lesseeName || "Không rõ"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="calendar" size={14} color="#6B7280" />
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Bắt đầu: </Text>
              {item.expectedStartDate
                ? new Date(item.expectedStartDate).toLocaleDateString("vi-VN")
                : "—"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="calendar" size={14} color="#6B7280" />
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Kết thúc: </Text>
              {item.expectedEndDate
                ? new Date(item.expectedEndDate).toLocaleDateString("vi-VN")
                : "—"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="dollar-sign" size={14} color="#6B7280" />
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Giá đề xuất: </Text>
              {item.offeredPrice
                ? `${item.offeredPrice.toLocaleString("vi-VN")} VND`
                : "Thỏa thuận"}
            </Text>
          </View>
          {!!item.purpose && (
            <View style={styles.infoRow}>
              <Feather name="briefcase" size={14} color="#6B7280" />
              <Text style={styles.infoText}>
                <Text style={styles.bold}>Mục đích: </Text>
                {item.purpose}
              </Text>
            </View>
          )}
          {!!item.note && (
            <View style={styles.infoRow}>
              <Feather name="file-text" size={14} color="#6B7280" />
              <Text style={styles.infoText}>
                <Text style={styles.bold}>Ghi chú: </Text>
                {item.note}
              </Text>
            </View>
          )}
        </View>

        {/* Nút hành động */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.rejectBtn]}
            onPress={() =>
              handleUpdateStatus(item.id || item.Id, "Rejected", item.lesseeId || item.LesseeId)
            }
          >
            <Feather name="x-circle" size={16} color="#EF4444" />
            <Text style={styles.rejectBtnText}>Từ chối</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.approveBtn]}
            onPress={() =>
              handleUpdateStatus(item.id || item.Id, "Approved", item.lesseeId || item.LesseeId)
            }
          >
            <Feather name="check-circle" size={16} color="#fff" />
            <Text style={styles.approveBtnText}>Chấp nhận</Text>
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
          keyExtractor={(item) => (item.id || item.Id).toString()}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  emptyText: { fontSize: 16, color: "#6B7280", marginTop: 16, textAlign: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    overflow: "hidden",
  },
  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  listingImage: {
    width: 80,
    height: 70,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  listingInfo: { flex: 1 },
  listingName: { fontSize: 15, fontWeight: "700", color: "#111827", lineHeight: 20 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  listingAddr: { fontSize: 12, color: "#6B7280", flex: 1 },
  viewDetailRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 2 },
  viewDetailText: { fontSize: 12, color: "#00A67E", fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginHorizontal: 14 },
  cardBody: { padding: 14, gap: 6 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  infoText: { fontSize: 14, color: "#374151", flex: 1 },
  bold: { fontWeight: "bold", color: "#111827" },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    padding: 14,
    paddingTop: 0,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  rejectBtn: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FEE2E2" },
  rejectBtnText: { color: "#EF4444", fontWeight: "700" },
  approveBtn: { backgroundColor: "#00A67E" },
  approveBtnText: { color: "#fff", fontWeight: "700" },
});
