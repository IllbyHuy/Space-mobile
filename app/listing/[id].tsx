import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from "expo-router"; // THÊM Stack VÀO ĐÂY
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getPriceUnitText } from "@/utils/formatPriceUnit";

const { width } = Dimensions.get("window");
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1556761175-5973dc0f32d7?auto=format&fit=crop&q=80&w=800";

// Logic ánh xạ ngày và giờ (bê từ Web sang)
const DAY_LABELS: Record<number, string> = {
  0: "Chủ Nhật",
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7",
};
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const formatTime = (timeString: string) => {
  if (!timeString) return "";
  const parts = timeString.split(":");
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${hours}:${minutes} ${ampm}`;
  }
  return timeString;
};

const getPicUrl = (pic: any) => {
  if (!pic) return FALLBACK_IMAGE;
  if (typeof pic === "string") return pic;
  return pic.imageUrl || pic.url || FALLBACK_IMAGE;
};

export default function ListingDetailScreen() {
  const { id, openBooking } = useLocalSearchParams();
  const router = useRouter();
  
  useEffect(() => {
    if (openBooking === 'true') {
      setIsBookingModalOpen(true);
    }
  }, [openBooking]);
  const insets = useSafeAreaInsets();

  const [listing, setListing] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingOfferedPrice, setBookingOfferedPrice] = useState("");
  const [bookingDuration, setBookingDuration] = useState("1");
  const [bookingDurationUnit, setBookingDurationUnit] = useState("Months"); // Web default
  const [bookingPurpose, setBookingPurpose] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [businessCategories, setBusinessCategories] = useState<any[]>([]);
  // Default to tomorrow to pass backend validation
  const [bookingStartDate, setBookingStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  useFocusEffect(
    useCallback(() => {
    const fetchDetail = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("portal_token");
        const storedUserId = await AsyncStorage.getItem("current_user_id");
        setToken(storedToken);
        setCurrentUserId(storedUserId);

        const [spaceRes, listingRes, catRes] = await Promise.all([
          fetch(
            "https://flexi-space-capstone-project.onrender.com/api/Space/GetAll",
            { headers: { accept: "*/*" } },
          ),
          fetch(
            "https://flexi-space-capstone-project.onrender.com/api/Listing/GetAll",
            { headers: { accept: "*/*" } },
          ),
          fetch(
            "https://flexi-space-capstone-project.onrender.com/api/BussinessCategory/GetAll",
            { headers: { accept: "*/*" } },
          ),
        ]);

        if (catRes.ok) {
          const catData = await catRes.json();
          setBusinessCategories(Array.isArray(catData) ? catData : catData?.data || []);
        }

        let spaces: any[] = [];
        if (spaceRes.ok) spaces = await spaceRes.json();

        if (listingRes.ok) {
          const listingData = await listingRes.json();
          const safeData = Array.isArray(listingData)
            ? listingData
            : listingData?.data || listingData?.items || [];

          const found = safeData.find(
            (item: any) =>
              item.id?.toString() === id || item.Id?.toString() === id,
          );

          if (found) {
            let parentSpace = spaces.find(
              (s: any) => (s.id || s.Id) === (found.spaceId || found.SpaceId),
            );
            let isSpacePart = false;

            if (!parentSpace) {
              // Try to fetch space part info
              try {
                const spRes = await fetch(`https://flexi-space-capstone-project.onrender.com/api/SpacePart/GetById/${found.spaceId || found.SpaceId}`);
                if (spRes.ok) {
                  parentSpace = await spRes.json();
                  isSpacePart = true;
                }
              } catch(e) {}
            }

            const merged = {
              ...found,
              area: found.area || parentSpace?.area || null,
              address:
                found.location ||
                found.address ||
                parentSpace?.address ||
                parentSpace?.location ||
                "",
              amenities: found.amenities || parentSpace?.amenities || [],
              operatingHours:
                found.operatingHours || parentSpace?.operatingHours || [],
              allowedCategories:
                found.spaceAllowedCategories ||
                parentSpace?.spaceAllowedCategories ||
                [],
              isSpacePart,
            };
            // Store the parent space's ownerId for owner detection
            if (parentSpace) {
              merged._spaceOwnerId = parentSpace.ownerId || parentSpace.OwnerId || parentSpace.creatorId || parentSpace.createdBy;
            }
            setListing(merged);
            if (merged.price) setBookingOfferedPrice(merged.price.toString());
          }
        }

        if (storedToken && id) {
          const favRes = await fetch(
            "https://flexi-space-capstone-project.onrender.com/api/FavoriteList/FavoriteByUser",
            {
              headers: {
                Authorization: `Bearer ${storedToken}`,
                accept: "*/*",
              },
            },
          );
          if (favRes.ok) {
            const favData = await favRes.json();
            const favArray = Array.isArray(favData)
              ? favData
              : favData?.data || favData?.items || favData?.listingIds || [];
            const isFav = favArray.some((item: any) => {
              if (typeof item === "number" || typeof item === "string")
                return item.toString() === id.toString();
              const itemId =
                item?.listingId ||
                item?.ListingId ||
                item?.listing?.id ||
                item?.id ||
                item?.Id;
              return itemId?.toString() === id.toString();
            });
            setIsFavorite(isFav);
          }
        }
      } catch (error) {
        console.error("Lỗi tải chi tiết:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchDetail();
    }, [id])
  );

  const handleToggleFavorite = async () => {
    if (!token) {
      Alert.alert("Yêu cầu đăng nhập", "Vui lòng đăng nhập để lưu mặt bằng!", [
        { text: "Để sau", style: "cancel" },
        { text: "Đăng nhập", onPress: () => router.push("/login") },
      ]);
      return;
    }
    try {
      const numericId = Number(id);
      if (isFavorite) {
        const res = await fetch(
          `https://flexi-space-capstone-project.onrender.com/api/FavoriteList/listings/${numericId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}`, accept: "*/*" },
          },
        );
        if (res.ok) setIsFavorite(false);
      } else {
        const res = await fetch(
          "https://flexi-space-capstone-project.onrender.com/api/FavoriteList/listings",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              accept: "*/*",
            },
            body: JSON.stringify({ listingIds: [numericId] }),
          },
        );
        if (res.ok) setIsFavorite(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: listing?.name || "Mặt bằng cho thuê",
        message: `${listing?.name || "Mặt bằng cho thuê"} - ${listing?.address || ""}`,
      });
    } catch (err) {
      console.error("Lỗi chia sẻ:", err);
    }
  };

  const openBookingModal = () => {
    if (!token) {
      Alert.alert(
        "Yêu cầu đăng nhập",
        "Vui lòng đăng nhập để gửi yêu cầu thuê!",
        [
          { text: "Để sau", style: "cancel" },
          { text: "Đăng nhập", onPress: () => router.push("/login") },
        ],
      );
      return;
    }
    setIsBookingModalOpen(true);
  };

  const handleSubmitBooking = async () => {
    if (!token || !listing) return;
    if (!bookingOfferedPrice || !bookingDuration || !bookingPurpose.trim()) {
      Alert.alert(
        "Thiếu thông tin",
        "Vui lòng điền đầy đủ giá đề nghị, thời hạn và mục đích sử dụng.",
      );
      return;
    }

    setIsSubmittingBooking(true);
    try {
      const payload = {
        listingId: Number(listing.id || listing.Id),
        offeredPrice: Number(bookingOfferedPrice),
        duration: Number(bookingDuration),
        durationUnit: bookingDurationUnit,
        purpose: bookingPurpose.trim(),
        note: bookingNote.trim(),
        expectedStartDate: new Date(bookingStartDate).toISOString(),
      };

      console.log('[BookingRequest] payload:', JSON.stringify(payload));

      const response = await fetch(
        "https://flexi-space-capstone-project.onrender.com/api/PrimaryBookingRequest/Create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (response.ok) {
        setIsBookingModalOpen(false);
        Alert.alert(
          "Thành công",
          "Gửi yêu cầu thuê thành công! Vui lòng chờ chủ nhà duyệt.",
        );
      } else {
        const rawText = await response.text();
        console.error('[BookingRequest] Error response:', response.status, rawText);
        let errMsg = 'Có lỗi xảy ra khi gửi yêu cầu.';
        try {
          const errObj = rawText ? JSON.parse(rawText) : {};
          errMsg = errObj.message || errObj.title || errObj.detail || JSON.stringify(errObj.errors || errObj);
        } catch {}
        Alert.alert("Lỗi", errMsg);
      }
    } catch (error) {
      console.error("Lỗi API Booking:", error);
      Alert.alert("Lỗi", "Không thể kết nối đến máy chủ.");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: "#fff" }]}>
        {/* TẮT HEADER MẶC ĐỊNH LÚC ĐANG LOADING */}
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#00A67E" />
      </View>
    );
  }

  const handleContactPress = async () => {
    if (!token) {
      Alert.alert(
        "Yêu cầu đăng nhập",
        "Vui lòng đăng nhập để gửi yêu cầu thuê!",
        [
          { text: "Để sau", style: "cancel" },
          { text: "Đăng nhập", onPress: () => router.push("/login") },
        ],
      );
      return;
    }
    try {
      const ownerId = listing._spaceOwnerId || listing.ownerId || listing.creatorId || listing.createdBy;
      if (ownerId && currentUserId) {
        const res = await fetch(`https://flexi-space-capstone-project.onrender.com/api/Conversation/ByParticipants?lessorId=${ownerId}&lesseeId=${currentUserId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const conv = await res.json();
          if (conv && (conv.id || conv.Id)) {
            router.push({ pathname: '/chat', params: { conversationId: conv.id || conv.Id, listingId: listing?.id || listing?.Id } });
            return;
          }
        }
      }
    } catch (e) {
      console.log("Error checking conversation:", e);
    }
    // No existing conversation, open booking modal
    setIsBookingModalOpen(true);
  };

  if (!listing) return null;

  const isOwner = currentUserId && listing && (
    String(listing._spaceOwnerId || '') === String(currentUserId) ||
    String(listing.ownerId || '') === String(currentUserId) ||
    String(listing.creatorId || '') === String(currentUserId) ||
    String(listing.createdBy || '') === String(currentUserId)
  );

  const rawPictures = listing.listingPictures || [];
  const mainImage =
    rawPictures.length > 0 ? getPicUrl(rawPictures[0]) : FALLBACK_IMAGE;
  const isHourly =
    listing.listingType === "SharedSpace" || listing.isHourly === true;

  const activeAmenities =
    listing.amenities?.filter((a: any) => a.isActive !== false) || [];
  const operatingHours = listing.operatingHours || [];
  const rawAllowedCategories = listing.allowedCategories || [];
  const allowedCategories = rawAllowedCategories
    .map((cat: any) => {
      const catId = cat?.bussinessCategoryId ?? cat?.businessCategoryId ?? cat?.categoryId;
      const found = businessCategories.find((c: any) => c.id === catId || c.Id === catId);
      return {
        ...cat,
        name: cat.name || cat.categoryName || found?.name || found?.Name || (catId ? `Ngành ${catId}` : null),
      };
    })
    .filter((cat: any) => cat.name);

  return (
    <View style={styles.container}>
      {/* ĐÂY LÀ ĐIỂM MẤU CHỐT: Tắt thanh tiêu đề mặc định của Expo Router */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* NÚT BACK OVERLAY (Sẽ nằm chìm lên trên bức ảnh tràn viền) */}
      <TouchableOpacity
        style={[styles.backBtn, { top: Math.max(insets.top, 20) + 10 }]}
        onPress={() => router.back()}
      >
        <Feather name="chevron-left" size={24} color="#111827" />
      </TouchableOpacity>

      {/* NÚT SHARE/SAVE OVERLAY */}
      <View
        style={[styles.topRightActions, { top: Math.max(insets.top, 20) + 10 }]}
      >
        <TouchableOpacity style={styles.iconBtnOverlay} onPress={handleShare}>
          <Feather name="share" size={20} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtnOverlay}
          onPress={handleToggleFavorite}
        >
          <Feather
            name="heart"
            size={20}
            color={isFavorite ? "#E02424" : "#111827"}
            style={isFavorite ? { transform: [{ scale: 1.05 }] } : undefined}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* 1. ẢNH BÌA TRÀN VIỀN LÊN TẬN MÉP TRÊN */}
        {rawPictures.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {rawPictures.map((pic: any, idx: number) => (
              <Image key={idx} source={{ uri: getPicUrl(pic) || FALLBACK_IMAGE }} style={[styles.coverImage, { width: Dimensions.get('window').width }]} />
            ))}
          </ScrollView>
        ) : (
          <Image source={{ uri: FALLBACK_IMAGE }} style={styles.coverImage} />
        )}

        <View style={styles.contentBody}>
          {/* 2. HEADER THÔNG TIN */}
          <View style={styles.titleSection}>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <View style={[styles.tagWrap, isHourly ? { backgroundColor: '#DBEAFE' } : { backgroundColor: '#ECFDF5' }]}>
                <Text style={[styles.tagText, isHourly ? { color: '#1D4ED8' } : { color: '#047857' }]}>
                  {isHourly ? "Chia sẻ chỗ" : "Thuê dài hạn"}
                </Text>
              </View>
              {listing.isSpacePart && (
                <View style={[styles.tagWrap, { backgroundColor: '#F3E8FF' }]}>
                  <Text style={[styles.tagText, { color: '#7E22CE' }]}>Từ MB gốc</Text>
                </View>
              )}
            </View>
            <Text style={styles.title}>
              {listing.name || "Mặt bằng cho thuê"}
            </Text>
            <Text style={styles.location}>
              <Feather name="map-pin" size={14} color="#6B7280" />{" "}
              {listing.address}
            </Text>
          </View>

          {/* 3. THÔNG SỐ CHÍNH */}
          <View style={styles.specsRow}>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>Mức giá</Text>
              <Text style={styles.specValue}>
                {listing.price
                  ? `${listing.price.toLocaleString("vi-VN")} đ/${listing.priceUnit ? getPriceUnitText(listing.priceUnit) : (isHourly ? "giờ" : "tháng")}`
                  : "Thỏa thuận"}
              </Text>
            </View>
            <View style={styles.specDivider} />
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>Diện tích</Text>
              <Text style={styles.specValue}>
                {listing.area ? `${listing.area} m²` : "N/A"}
              </Text>
            </View>
          </View>

          {/* 4. CHỦ NHÀ */}
          {!isOwner && (
            <TouchableOpacity 
              style={styles.hostSection}
              onPress={() => {
                const uId = listing.creatorId || listing.CreatorId;
                if (uId) router.push(`/public-profile/${uId}` as any);
              }}
            >
              <View style={styles.hostAvatar}>
                <Text style={styles.hostAvatarText}>
                  {(listing.lessorName || "CH").substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hostName}>
                  Chủ nhà {listing.lessorName || "Ẩn danh"}
                </Text>
                <Text style={styles.hostStatus}>Đang hoạt động</Text>
              </View>
              <TouchableOpacity style={styles.chatIconBtn} onPress={handleContactPress}>
                <Feather name="message-circle" size={20} color="#00A67E" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {/* 5. MÔ TẢ */}
          <View style={styles.descSection}>
            <Text style={styles.sectionTitle}>Thông tin mô tả</Text>
            <Text 
              style={styles.description}
              numberOfLines={isDescExpanded ? undefined : 4}
            >
              {listing.description ||
                "Chủ nhà chưa cung cấp mô tả chi tiết cho mặt bằng này."}
            </Text>
            {listing.description && listing.description.length > 150 && (
              <TouchableOpacity onPress={() => setIsDescExpanded(!isDescExpanded)}>
                <Text style={{ color: "#00A67E", marginTop: 4, fontWeight: "500" }}>
                  {isDescExpanded ? "Thu gọn" : "Xem chi tiết"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 6. TIỆN ÍCH */}
          {activeAmenities.length > 0 && (
            <View style={styles.descSection}>
              <Text style={styles.sectionTitle}>Tiện ích</Text>
              <View style={styles.amenitiesWrap}>
                {activeAmenities.map((a: any, idx: number) => (
                  <View key={idx} style={styles.amenityBadge}>
                    <Feather name="check" size={14} color="#00A67E" />
                    <Text style={styles.amenityText}>{a.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 7. MỤC ĐÍCH SỬ DỤNG */}
          {allowedCategories.length > 0 && (
            <View style={styles.descSection}>
              <Text style={styles.sectionTitle}>Phù hợp kinh doanh</Text>
              <View style={styles.amenitiesWrap}>
                {allowedCategories.map((cat: any, idx: number) => {
                  const label =
                    typeof cat === "string"
                      ? cat
                      : cat.name || cat.categoryName || cat.title || "";
                  return (
                    <View key={idx} style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* 8. GIỜ HOẠT ĐỘNG */}
          {operatingHours.length > 0 && (
            <View style={styles.descSection}>
              <Text style={styles.sectionTitle}>Giờ hoạt động</Text>
              <View style={styles.hoursBox}>
                {DAY_ORDER.map((day, idx) => {
                  const entry = operatingHours.find(
                    (h: any) => h.dayOfWeek === day,
                  );
                  return (
                    <View
                      key={day}
                      style={[
                        styles.hourRow,
                        idx === DAY_ORDER.length - 1 && {
                          borderBottomWidth: 0,
                        },
                      ]}
                    >
                      <Text style={styles.hourDay}>{DAY_LABELS[day]}</Text>
                      {entry ? (
                        <Text style={styles.hourTime}>
                          {formatTime(entry.openTime)} -{" "}
                          {formatTime(entry.closeTime)}
                        </Text>
                      ) : (
                        <Text style={styles.hourClosed}>Đóng cửa</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* BỔ SUNG: LỊCH SỬ GIÁ CHO THUÊ (như Web) */}
          <View style={styles.descSection}>
            <Text style={styles.sectionTitle}>Lịch sử giá cho thuê</Text>
            <View style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 16, backgroundColor: '#fff', gap: 16 }}>
              <View>
                <Text style={{ color: '#777', fontSize: 13, marginBottom: 4 }}>Giá hiện tại</Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#00A67E' }}>
                  {listing.price ? `${listing.price.toLocaleString('vi-VN')} ₫/${listing.priceUnit ? getPriceUnitText(listing.priceUnit) : (isHourly ? "giờ" : "tháng")}` : 'N/A'}
                </Text>
              </View>
              <View>
                <Text style={{ color: '#777', fontSize: 13, marginBottom: 4 }}>Biến động trong 1 tháng</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather name="trending-up" size={16} color="#00A67E" />
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#333' }}>0% (Giữ giá)</Text>
                </View>
              </View>
              <View>
                <Text style={{ color: '#777', fontSize: 13, marginBottom: 4 }}>Đánh giá thị trường</Text>
                <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>⭐ Giá phổ biến khu vực</Text>
              </View>
            </View>
          </View>

          {/* BỔ SUNG: THÔNG TIN THÊM (Ngày đăng, mã, etc) */}
          <View style={[styles.descSection, { paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', marginBottom: 20 }]}>
             <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <View style={{ width: '48%', marginBottom: 16 }}>
                  <Text style={{ color: '#777', fontSize: 12, marginBottom: 4 }}><Feather name="calendar" size={12}/> Ngày đăng</Text>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#333' }}>
                    {listing.createdAt ? new Date(listing.createdAt).toLocaleDateString('vi-VN') : 'Hôm nay'}
                  </Text>
                </View>
                <View style={{ width: '48%', marginBottom: 16 }}>
                  <Text style={{ color: '#777', fontSize: 12, marginBottom: 4 }}><Feather name="calendar" size={12}/> Ngày hết hạn</Text>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#333' }}>
                    {listing.allowedEndTime ? new Date(listing.allowedEndTime).toLocaleDateString('vi-VN') : 'Sau 30 ngày'}
                  </Text>
                </View>
                <View style={{ width: '48%' }}>
                  <Text style={{ color: '#777', fontSize: 12, marginBottom: 4 }}><Feather name="hash" size={12}/> Mã tin</Text>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#333' }}>#{listing.id || listing.Id}</Text>
                </View>
                <View style={{ width: '48%' }}>
                  <Text style={{ color: '#777', fontSize: 12, marginBottom: 4 }}><Feather name="info" size={12}/> Tình trạng</Text>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#333' }}>{listing.status === 'published' ? 'Đang hoạt động' : listing.status}</Text>
                </View>
             </View>
          </View>

          {/* 9. BẢN ĐỒ (HỖ TRỢ CẢ WEB VÀ MOBILE) */}
          <View style={styles.descSection}>
            <Text style={styles.sectionTitle}>Vị trí</Text>
            <View
              style={{
                height: 250,
                borderRadius: 12,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "#E5E7EB",
                backgroundColor: "#F3F4F6",
              }}
            >
              {Platform.OS === "web" ? (
                <iframe
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(listing.address || "Hồ Chí Minh")}&output=embed`}
                  style={{ border: 0 }}
                />
              ) : (
                <WebView
                  source={{
                    html: `
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                          <style>
                            body { margin: 0; padding: 0; }
                            iframe { width: 100vw; height: 100vh; border: none; }
                          </style>
                        </head>
                        <body>
                          <iframe src="https://maps.google.com/maps?q=${encodeURIComponent(listing.address || "Hồ Chí Minh")}&output=embed"></iframe>
                        </body>
                      </html>
                    `
                  }}
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                  scrollEnabled={false}
                />
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* STICKY BOTTOM BAR - Owner vs Visitor */}
      {(() => {
        if (isOwner) {
          return (
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 16 }]}>
              <TouchableOpacity
                style={[styles.bookBtn, { flex: 1, marginRight: 8, backgroundColor: '#00A67E', flexDirection: 'row', justifyContent: 'center' }]}
                onPress={() => router.push(`/listing/edit-listing?id=${listing.id || listing.Id}`)}
              >
                <Feather name="edit" size={18} color="#fff" />
                <Text style={[styles.bookBtnText, { marginLeft: 6 }]}>Chỉnh sửa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bookBtn, { flex: 1, backgroundColor: '#EF4444', flexDirection: 'row', justifyContent: 'center' }]}
                onPress={() => {
                  Alert.alert('Xác nhận', 'Bạn có chắc muốn xóa bài đăng này?', [
                    { text: 'Hủy', style: 'cancel' },
                    {
                      text: 'Xóa', style: 'destructive', onPress: async () => {
                        try {
                          const res = await fetch(
                            `https://flexi-space-capstone-project.onrender.com/api/Listing/Delete/${listing.id || listing.Id}`,
                            { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, accept: '*/*' } }
                          );
                          if (res.ok) {
                            Alert.alert('Thành công', 'Đã xóa bài đăng!', [{ text: 'OK', onPress: () => router.back() }]);
                          } else {
                            Alert.alert('Lỗi', 'Không thể xóa bài đăng.');
                          }
                        } catch (e) {
                          Alert.alert('Lỗi', 'Đã xảy ra lỗi khi xóa.');
                        }
                      }
                    },
                  ]);
                }}
              >
                <Feather name="trash-2" size={18} color="#fff" />
                <Text style={[styles.bookBtnText, { marginLeft: 6 }]}>Xóa</Text>
              </TouchableOpacity>
            </View>
          );
        }
        return (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bottomPrice}>
                {listing?.price ? `${listing.price.toLocaleString("vi-VN")} đ` : "Thỏa thuận"}
                <Text style={styles.bottomUnit}>
                  {listing?.priceUnit ? `/${getPriceUnitText(listing.priceUnit)}` : (isHourly ? "/giờ" : "/tháng")}
                </Text>
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flex: 1.5 }}>
              <TouchableOpacity style={[styles.bookBtn, { flex: 1, backgroundColor: '#f1f5f9' }]} onPress={handleContactPress}>
                <Text style={[styles.bookBtnText, { color: '#00A67E' }]}>Chat ngay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bookBtn, { flex: 1 }]} onPress={() => setIsBookingModalOpen(true)}>
                <Text style={styles.bookBtnText}>Yêu cầu</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      <Modal
        visible={isBookingModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsBookingModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalCard, { paddingBottom: insets.bottom || 20 }]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gửi yêu cầu thuê</Text>
              <TouchableOpacity onPress={() => setIsBookingModalOpen(false)}>
                <Feather name="x" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Giá đề nghị (đ)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={bookingOfferedPrice}
                onChangeText={setBookingOfferedPrice}
                placeholder="Nhập giá đề nghị"
              />

              <Text style={styles.modalLabel}>Thời lượng thuê</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={bookingDuration}
                onChangeText={setBookingDuration}
                placeholder="Số lượng"
              />

              <Text style={styles.modalLabel}>Đơn vị</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {(['Days', 'Months', 'Years'] as const).map(unit => (
                  <TouchableOpacity
                    key={unit}
                    onPress={() => setBookingDurationUnit(unit)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                      backgroundColor: bookingDurationUnit === unit ? '#00A67E' : '#F3F4F6',
                      borderWidth: 1, borderColor: bookingDurationUnit === unit ? '#00A67E' : '#D1D5DB',
                    }}
                  >
                    <Text style={{ color: bookingDurationUnit === unit ? '#fff' : '#374151', fontWeight: '600', fontSize: 14 }}>
                      {unit === 'Days' ? 'Ngày' : unit === 'Months' ? 'Tháng' : 'Năm'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Ngày dự kiến bắt đầu (YYYY-MM-DD)</Text>
              {Platform.OS === 'web' ? (
                React.createElement('input', {
                  type: 'date',
                  value: bookingStartDate || '',
                  min: new Date().toISOString().split("T")[0],
                  onChange: (e: any) => setBookingStartDate(e.target.value),
                  style: { padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', width: '100%', fontSize: '16px', boxSizing: 'border-box' }
                })
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.modalInput, { justifyContent: "center" }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={{ color: bookingStartDate ? "#111827" : "#9CA3AF" }}>
                      {bookingStartDate || "Chọn ngày"}
                    </Text>
                  </TouchableOpacity>
                  {Platform.OS === 'android' && showDatePicker && (
                    <DateTimePicker
                      value={new Date(bookingStartDate || Date.now())}
                      mode="date"
                      display="default"
                      minimumDate={new Date()}
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) {
                          setBookingStartDate(selectedDate.toISOString().split("T")[0]);
                        }
                      }}
                    />
                  )}
                  {Platform.OS === 'ios' && (
                    <Modal visible={showDatePicker} transparent animationType="slide">
                      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <View style={{ backgroundColor: '#fff', paddingBottom: insets.bottom || 20 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                              <Text style={{ color: '#00A67E', fontWeight: 'bold', fontSize: 16 }}>Xong</Text>
                            </TouchableOpacity>
                          </View>
                          <DateTimePicker
                            value={new Date(bookingStartDate || Date.now())}
                            mode="date"
                            display="spinner"
                            minimumDate={new Date()}
                            onChange={(event, selectedDate) => {
                              if (selectedDate) {
                                setBookingStartDate(selectedDate.toISOString().split("T")[0]);
                              }
                            }}
                          />
                        </View>
                      </View>
                    </Modal>
                  )}
                </>
              )}

              <Text style={styles.modalLabel}>Mục đích sử dụng</Text>
              <TextInput
                style={styles.modalInput}
                value={bookingPurpose}
                onChangeText={setBookingPurpose}
                placeholder="VD: Kinh doanh cà phê"
              />

              <Text style={styles.modalLabel}>Ghi chú (không bắt buộc)</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { height: 80, textAlignVertical: "top" },
                ]}
                value={bookingNote}
                onChangeText={setBookingNote}
                placeholder="Ghi chú thêm cho chủ nhà"
                multiline
              />

              <TouchableOpacity
                style={[
                  styles.bookBtn,
                  { alignSelf: "stretch", alignItems: "center", marginTop: 8 },
                  isSubmittingBooking && { opacity: 0.7 },
                ]}
                onPress={handleSubmitBooking}
                disabled={isSubmittingBooking}
              >
                {isSubmittingBooking ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.bookBtnText}>Xác nhận gửi yêu cầu</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    elevation: 4,
  },
  topRightActions: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    gap: 10,
  },
  iconBtnOverlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    elevation: 4,
  },
  coverImage: { width: width, height: 320, resizeMode: "cover" },
  contentBody: { padding: 20 },
  titleSection: { marginBottom: 24 },
  tagWrap: {
    alignSelf: "flex-start",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  tagText: { color: "#047857", fontSize: 12, fontWeight: "bold" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
    lineHeight: 30,
  },
  location: { fontSize: 14, color: "#6B7280" },
  specsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F3F4F6",
    paddingVertical: 16,
    marginBottom: 24,
  },
  specBox: { flex: 1, alignItems: "center" },
  specDivider: { width: 1, backgroundColor: "#F3F4F6" },
  specLabel: { fontSize: 13, color: "#6B7280", marginBottom: 4 },
  specValue: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  hostSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#00A67E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  hostAvatarText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  hostName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 2,
  },
  hostStatus: { fontSize: 13, color: "#10B981" },
  chatIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    elevation: 2,
  },
  descSection: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },
  description: { fontSize: 15, lineHeight: 24, color: "#4B5563" },
  amenitiesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amenityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  amenityText: { fontSize: 14, color: "#374151" },
  categoryBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#EEF2F7",
    borderRadius: 20,
  },
  categoryText: { fontSize: 13, color: "#1E293B", fontWeight: "500" },
  hoursBox: {
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 12,
    overflow: "hidden",
  },
  hourRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  hourDay: { fontSize: 14, color: "#374151", fontWeight: "500" },
  hourTime: { fontSize: 14, color: "#10B981", fontWeight: "600" },
  hourClosed: { fontSize: 14, color: "#9CA3AF" },
  mapMockup: {
    height: 180,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  bottomPrice: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  bottomUnit: { fontSize: 14, color: "#6B7280", fontWeight: "normal" },
  bookBtn: {
    backgroundColor: "#111827",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  bookBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
});
