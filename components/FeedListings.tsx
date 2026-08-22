import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Share,
  Alert,
  ScrollView,
  Dimensions,
  Linking,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPriceUnitText } from "@/utils/formatPriceUnit";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800";

const unwrapApiList = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.result)) return value.result;
  if (Array.isArray(value?.value)) return value.value;
  if (Array.isArray(value?.Value)) return value.Value;
  return [];
};

const getPictureUrl = (value: any): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return (
    value.url ||
    value.pictureUrl ||
    value.imageUrl ||
    value.fileUrl ||
    value.path ||
    value.secureUrl ||
    ""
  );
};

const getBannerImageUrl = (banner: any): string => {
  const directUrl = getPictureUrl(banner);
  if (directUrl) return directUrl;
  const collections = [
    banner.bannerPictures,
    banner.pictures,
    banner.images,
    banner.bannerPicture,
    banner.picture,
  ];
  for (const collection of collections) {
    if (Array.isArray(collection) && collection.length > 0) {
      const url = getPictureUrl(collection[0]);
      if (url) return url;
    }
    const url = getPictureUrl(collection);
    if (url) return url;
  }
  return FALLBACK_IMAGE;
};

const getPicUrl = (pic: any) => {
  if (!pic) return FALLBACK_IMAGE;
  if (typeof pic === "string") return pic;
  return pic.imageUrl || pic.url || FALLBACK_IMAGE;
};

// Nhận thêm headerPadding để căn lề trên
export const FeedListings = ({
  onScroll,
  headerPadding = 0,
  searchQuery = "",
  showFavoritesOnly = false,
  listingTypeFilters = [],
  priceSortFilter = 'none',
}: {
  onScroll?: any;
  headerPadding?: number;
  searchQuery?: string;
  showFavoritesOnly?: boolean;
  listingTypeFilters?: string[];
  priceSortFilter?: 'none' | 'asc' | 'desc';
}) => {
  const [listings, setListings] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [isBannerDragging, setIsBannerDragging] = useState(false);
  const bannerScrollRef = useRef<ScrollView>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const screenWidth = Dimensions.get("window").width;

  const PROMO_BANNERS = useMemo(() => [
    {
      id: 'promo-pricing',
      _type: 'promo',
      title: 'Nâng cấp gói hiển thị',
      description: 'Tăng khả năng tiếp cận với gói bài đăng ưu tiên & banner quảng cáo.',
      bgColor: '#1E3A5F',
      icon: 'zap',
      onPress: () => router.push('/pricing' as any),
      imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800',
    },
    {
      id: 'promo-ai',
      _type: 'promo',
      title: 'AI Chỉnh Sửa Ảnh',
      description: 'Biến đổi không gian của bạn bằng AI: tô vùng & thêm vật thể.',
      bgColor: '#064E3B',
      icon: 'aperture',
      onPress: () => router.push('/ai-explanation' as any),
      imageUrl: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?auto=format&fit=crop&q=80&w=800',
    },
  ], []);

  const allBannerItems = useMemo(() => [
    ...banners.map(b => ({ ...b, _type: 'api' })),
    ...PROMO_BANNERS,
  ], [banners, PROMO_BANNERS]);

  const fetchFeed = async () => {
    try {
      const storedToken = await AsyncStorage.getItem("portal_token");
      setToken(storedToken);

      const headers: any = { accept: "*/*" };
      if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;

      const [spaceRes, listingRes, bannerRes] = await Promise.all([
        fetch(
          "https://flexi-space-capstone-project.onrender.com/api/Space/GetAll",
          { headers: { accept: "*/*" } },
        ),
        fetch(
          "https://flexi-space-capstone-project.onrender.com/api/Listing/GetAll",
          { headers },
        ),
        fetch(
          "https://flexi-space-capstone-project.onrender.com/api/Banner/GetAll",
          { headers: { accept: "*/*" } },
        ),
      ]);

      let spaces: any[] = [];
      if (spaceRes.ok) {
        const spaceData = await spaceRes.json();
        spaces = Array.isArray(spaceData) ? spaceData : (spaceData?.data || spaceData?.items || []);
      }

      if (listingRes.ok) {
        const listingData = await listingRes.json();
        let safeData: any[] = Array.isArray(listingData)
          ? listingData
          : listingData?.data || listingData?.items || [];

        // Filter occupied
        safeData = safeData.filter(
          (item: any) =>
            item.status !== "Occupied" &&
            String(item.status) !== "1" &&
            item.Status !== "Occupied" &&
            String(item.Status) !== "1",
        );

        // Identify which listings belong to a SpacePart (spaceId not found in spaces list)
        const spacePartPromises: number[] = [];
        const mapped = safeData.map((l: any) => {
          const currentSpaceId = l.spaceId || l.SpaceId;
          const parentSpace = spaces.find((s: any) => (s.id || s.Id) == currentSpaceId);
          const isSpacePart = !parentSpace;
          if (isSpacePart && currentSpaceId) spacePartPromises.push(currentSpaceId);
          return { ...l, isSpacePart, _tempSpaceId: currentSpaceId, _parentSpace: parentSpace };
        });

        // Fetch unique space parts by ID (same as Web)
        const uniqueSpacePartIds = Array.from(new Set(spacePartPromises));
        const fetchedSpaceParts: Record<number, any> = {};
        if (uniqueSpacePartIds.length > 0) {
          await Promise.all(
            uniqueSpacePartIds.map(async (spId) => {
              try {
                const res = await fetch(
                  `https://flexi-space-capstone-project.onrender.com/api/SpacePart/GetById/${spId}`,
                  { headers },
                );
                if (res.ok) fetchedSpaceParts[spId] = await res.json();
              } catch (e) {}
            }),
          );
        }

        // Merge area, address, spaceOwnerId (exactly like Web HomeListings)
        safeData = mapped.map((l: any) => {
          const spaceOrPart: any = l._parentSpace || fetchedSpaceParts[l._tempSpaceId];
          let address = l.spaceAddress || l.location || l.address || "";
          let city = l.city || l.spaceCity || "";
          let computedArea = l.area || l.Area || spaceOrPart?.area || spaceOrPart?.Area || null;

          if (l.isSpacePart && spaceOrPart?.parentSpaceId) {
            const parent = spaces.find((s: any) => (s.id || s.Id) == spaceOrPart.parentSpaceId);
            if (parent && !address) {
              address = parent.address || parent.location || "";
              city = parent.city || "";
            }
          } else if (spaceOrPart && !address) {
            address = spaceOrPart.address || spaceOrPart.location || "";
            city = spaceOrPart.city || "";
          }

          const parentForOwner = l.isSpacePart && spaceOrPart?.parentSpaceId
            ? spaces.find((s: any) => (s.id || s.Id) == spaceOrPart.parentSpaceId)
            : null;

          const _spaceOwnerId =
            spaceOrPart?.ownerId || spaceOrPart?.createdBy || spaceOrPart?.OwnerId || spaceOrPart?.CreatedBy ||
            parentForOwner?.ownerId || parentForOwner?.createdBy || parentForOwner?.OwnerId || parentForOwner?.CreatedBy ||
            null;

          return {
            ...l,
            area: computedArea,
            address,
            city,
            isSpacePart: l.isSpacePart,
            _spaceOwnerId,
          };
        });

        // Banners
        if (bannerRes.ok) {
          const bannerData = await bannerRes.json();
          let rawBanners = unwrapApiList(bannerData);
          rawBanners.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          rawBanners = rawBanners.map((b: any) => {
            const assoc = safeData.find((l: any) => l.id === b.listingId || l.Id === b.listingId);
            if (assoc) b.listingStatus = assoc.status ?? assoc.Status;
            return b;
          });
          setBanners(
            rawBanners.filter(
              (b: any) =>
                (b.title || b.description || b.bannerPictures) &&
                b.listingStatus !== "Occupied" &&
                String(b.listingStatus) !== "1" &&
                b.listingStatus !== "Pending",
            ),
          );
        } else {
          setBanners([]);
        }

        // Do not sort by createdAt locally to preserve API's push-to-top order

        setListings(safeData);
      }

      if (storedToken) {
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
          const ids = favArray
            .map((item: any) => {
              if (typeof item === "number" || typeof item === "string")
                return item.toString();
              return (
                item?.listingId ||
                item?.ListingId ||
                item?.listing?.id ||
                item?.id ||
                item?.Id
              )?.toString();
            })
            .filter(Boolean);
          setFavoriteIds(new Set(ids));
        }
      }
    } catch (error) {
      console.error("Lỗi tải Feed:", error);
    }
  };


  useEffect(() => {
    fetchFeed().finally(() => setIsLoading(false));
  }, []);

  // Auto-rotate banner - runs at component level, NOT inside renderHeader
  useEffect(() => {
    if (allBannerItems.length <= 1) return;
    if (isBannerDragging) return;

    bannerTimerRef.current = setInterval(() => {
      setCurrentBannerIndex(prev => {
        const next = (prev + 1) % allBannerItems.length;
        bannerScrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
        return next;
      });
    }, 3500);

    return () => {
      if (bannerTimerRef.current) clearInterval(bannerTimerRef.current);
    };
  }, [allBannerItems.length, screenWidth, isBannerDragging]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  };

  const handleToggleFavorite = async (listingId: string | number) => {
    if (!token) {
      Alert.alert("Yêu cầu đăng nhập", "Vui lòng đăng nhập để lưu mặt bằng!", [
        { text: "Để sau", style: "cancel" },
        { text: "Đăng nhập", onPress: () => router.push("/login") },
      ]);
      return;
    }
    const idStr = listingId.toString();
    const isSaved = favoriteIds.has(idStr);
    try {
      if (isSaved) {
        const res = await fetch(
          `https://flexi-space-capstone-project.onrender.com/api/FavoriteList/listings/${Number(listingId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}`, accept: "*/*" },
          },
        );
        if (res.ok) {
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(idStr);
            return next;
          });
        }
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
            body: JSON.stringify({ listingIds: [Number(listingId)] }),
          },
        );
        if (res.ok) {
          setFavoriteIds((prev) => new Set(prev).add(idStr));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareListing = async (item: any) => {
    try {
      await Share.share({
        title: item.name || "Mặt bằng cho thuê",
        message: `${item.name || "Mặt bằng cho thuê"} - ${item.address || ""}`,
      });
    } catch (err) {
      console.error("Lỗi chia sẻ:", err);
    }
  };

  const renderFacebookStylePost = ({ item }: { item: any }) => {
    const rawPictures = item.listingPictures || [];
    const mainImage =
      rawPictures.length > 0 ? getPicUrl(rawPictures[0]) : FALLBACK_IMAGE;
    const isHourly =
      item.listingType === "SharedSpace" || item.isHourly === true;
    const itemId = item.id || item.Id;
    const isSaved = favoriteIds.has(itemId?.toString());

    return (
      <View style={styles.postContainer}>
        {/* HEADER */}
        <View style={styles.postHeader}>
          <TouchableOpacity 
            style={styles.avatar}
            onPress={() => {
              const uId = item.creatorId || item.CreatorId;
              if (uId) router.push(`/public-profile/${uId}` as any);
            }}
          >
            <Text style={styles.avatarText}>
              {(item.lessorName || "CH").substring(0, 2).toUpperCase()}
            </Text>
          </TouchableOpacity>
          <View style={styles.headerTextInfo}>
            <TouchableOpacity 
              onPress={() => {
                const uId = item.creatorId || item.CreatorId;
                if (uId) router.push(`/public-profile/${uId}` as any);
              }}
            >
              <Text style={styles.authorName}>
                Chủ nhà {item.lessorName || "Ẩn danh"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.timeAndLocation}>
              2 giờ trước • 📍 {item.address?.substring(0, 20) || "TP.HCM"}{item.city ? `, ${item.city}` : ""}
            </Text>
          </View>
          <View
            style={[
              styles.badgeWrapper,
              {
                flexDirection: "row",
                gap: 6,
                backgroundColor: "transparent",
                paddingHorizontal: 0,
                paddingVertical: 0,
              },
            ]}
          >
            {(() => {
              let typeBadge = { label: 'Dài hạn', bg: '#F0FDF4', color: '#166534' };
              const cIdBadge = item.creatorId || item.CreatorId;
              if (item.listingType === 'SharedSpace' && cIdBadge && item._spaceOwnerId && String(cIdBadge) !== String(item._spaceOwnerId)) {
                typeBadge = { label: 'Cho thuê lại', bg: '#FCE7F3', color: '#9D174D' };
              } else if (item.priceUnit === 'PerHour') {
                typeBadge = { label: 'Theo ca', bg: '#EEF2FF', color: '#3730A3' };
              } else if (item.listingType === 'SharedSpace') {
                typeBadge = { label: 'Chia sẻ', bg: '#EEF2FF', color: '#3730A3' };
              }

              let scopeBadge = { label: 'Nguyên căn', bg: '#ECFDF5', color: '#047857' };
              if (item.isSpacePart) {
                scopeBadge = { label: 'Diện tích chia nhỏ', bg: '#FEF9C3', color: '#854D0E' };
              }

              return (
                <>
                  <View style={[styles.badgeWrapper, { backgroundColor: typeBadge.bg }]}>
                    <Text style={[styles.badgeText, { color: typeBadge.color }]}>{typeBadge.label}</Text>
                  </View>
                  <View style={[styles.badgeWrapper, { backgroundColor: scopeBadge.bg }]}>
                    <Text style={[styles.badgeText, { color: scopeBadge.color }]}>{scopeBadge.label}</Text>
                  </View>
                </>
              );
            })()}
          </View>
        </View>

        {/* BODY TEXT */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push(`/listing/${item.id || item.Id}`)}
          style={styles.postBodyText}
        >
          <Text style={styles.postTitle}>
            {item.name || "Mặt bằng cho thuê siêu đẹp"}
          </Text>
          <Text style={styles.postPriceArea}>
            💰{" "}
            {item.price
              ? `${item.price.toLocaleString("vi-VN")} đ/${item.priceUnit ? getPriceUnitText(item.priceUnit) : (isHourly ? "giờ" : "tháng")}`
              : "Thỏa thuận"}{" "}
            • {item.area ? `${item.area}m²` : "N/A"}
          </Text>
          {isHourly && item.shareSpaceDetailAvailabilitiesTimes?.length > 0 && (() => {
            const firstSlot = item.shareSpaceDetailAvailabilitiesTimes[0];
            const formatToAmPm = (timeStr: string) => {
              if (!timeStr) return '';
              const [h, m] = timeStr.split(':');
              const hh = parseInt(h, 10);
              const ampm = hh >= 12 ? 'PM' : 'AM';
              const hh12 = hh % 12 || 12;
              return `${hh12.toString().padStart(2, '0')}:${m} ${ampm}`;
            };
            
            const dayStr = firstSlot.daysOfWeek?.length > 0 ? firstSlot.daysOfWeek.join(', ') : 'Hôm nay';
            let timeSlotStr = `⏱ ${dayStr}: ${formatToAmPm(firstSlot.startTime)} - ${formatToAmPm(firstSlot.endTime)}`;
            if (item.shareSpaceDetailAvailabilitiesTimes.length > 1) {
               timeSlotStr += ` (và ${item.shareSpaceDetailAvailabilitiesTimes.length - 1} ca khác)`;
            }
            
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                <Text style={{ fontSize: 13, color: "#64748B", fontWeight: '600' }}>
                  {timeSlotStr}
                </Text>
              </View>
            );
          })()}
        </TouchableOpacity>

        {/* MEDIA */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push(`/listing/${item.id || item.Id}`)}
        >
          <Image source={{ uri: mainImage }} style={styles.postImage} />
          {rawPictures.length > 1 && (
            <View style={styles.imageCountOverlay}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>
                +{rawPictures.length - 1}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* FOOTER */}
        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleToggleFavorite(itemId)}
          >
            <Feather
              name="heart"
              size={20}
              color={isSaved ? "#E02424" : "#65676B"}
            />
            <Text style={[styles.actionText, isSaved && { color: "#E02424" }]}>
              {isSaved ? "Đã lưu" : "Lưu tin"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleShareListing(item)}
          >
            <Feather name="share-2" size={20} color="#65676B" />
            <Text style={styles.actionText}>Chia sẻ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading)
    return (
      <ActivityIndicator
        size="large"
        color="#00A67E"
        style={{ marginTop: headerPadding + 40 }}
      />
    );

  let filteredListings = listings;

  if (showFavoritesOnly) {
    filteredListings = filteredListings.filter((item) =>
      favoriteIds.has((item.id || item.Id)?.toString()),
    );
  }

  if (listingTypeFilters && listingTypeFilters.length > 0) {
    filteredListings = filteredListings.filter((item) => {
      let matches = false;
      const cIdBadge = item.creatorId || item.CreatorId;
      
      if (listingTypeFilters.includes('timeslot')) {
        // "Theo ca / Chia sẻ khung giờ"
        if (item.priceUnit === 'PerHour' || item.listingType === 'SharedSpace') matches = true;
      }
      if (listingTypeFilters.includes('partial')) {
        // "Một góc/Kiot"
        if (item.isSpacePart === true) matches = true;
      }
      if (listingTypeFilters.includes('full')) {
        // "Nguyên căn"
        if (!item.isSpacePart) matches = true;
      }
      if (listingTypeFilters.includes('sublease')) {
        // "Cho thuê lại"
        if (item.listingType === 'SharedSpace' && cIdBadge && item._spaceOwnerId && String(cIdBadge) !== String(item._spaceOwnerId)) matches = true;
      }
      
      return matches;
    });
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (normalizedQuery) {
    filteredListings = filteredListings.filter(
      (item) =>
        (item.name || "").toLowerCase().includes(normalizedQuery) ||
        (item.address || "").toLowerCase().includes(normalizedQuery),
    );
  }

  if (priceSortFilter === 'asc') {
    filteredListings = [...filteredListings].sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (priceSortFilter === 'desc') {
    filteredListings = [...filteredListings].sort((a, b) => (b.price || 0) - (a.price || 0));
  }

  const renderHeader = () => {
    if (allBannerItems.length === 0) return null;
    return (
      <View style={styles.bannerContainer}>
        <ScrollView
          ref={bannerScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => setIsBannerDragging(true)}
          onScrollEndDrag={() => setIsBannerDragging(false)}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            setCurrentBannerIndex(idx);
          }}
        >
          {allBannerItems.map((b: any, idx: number) => {
            if (b._type === 'promo') {
              return (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.9}
                  onPress={b.onPress}
                  style={{ width: screenWidth }}
                >
                  <Image source={{ uri: b.imageUrl }} style={[styles.bannerImage, { opacity: 0.6 }]} />
                  <View style={[styles.bannerContent, { backgroundColor: b.bgColor + 'CC' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Feather name={b.icon} size={18} color="#00d4a0" />
                      <Text style={[styles.bannerTitle, { color: '#fff', fontSize: 16 }]}>{b.title}</Text>
                    </View>
                    <Text style={styles.bannerDesc} numberOfLines={2}>{b.description}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
                      <Text style={{ color: '#00d4a0', fontSize: 13, fontWeight: '700' }}>Khám phá ngay</Text>
                      <Feather name="arrow-right" size={13} color="#00d4a0" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }
            const imgUrl = getBannerImageUrl(b);
            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.9}
                onPress={() => {
                  if (b.listingId) {
                    router.push(`/listing/${b.listingId}`);
                  } else if (b.link) {
                    if (b.link.includes("ai-recommendation") || b.link.toLowerCase().includes("ai")) {
                      router.push("/ai-editor");
                    } else {
                      Linking.openURL(b.link);
                    }
                  }
                }}
                style={{ width: screenWidth }}
              >
                <Image source={{ uri: imgUrl }} style={styles.bannerImage} />
                <View style={styles.bannerContent}>
                  <Text style={styles.bannerTitle}>
                    {b.title || "Ưu đãi mặt bằng"}
                  </Text>
                  <Text style={styles.bannerDesc} numberOfLines={2}>
                    {b.description || "Khám phá không gian kinh doanh tuyệt vời"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {/* Dot Indicators */}
        <View style={styles.dotsContainer}>
          {allBannerItems.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => {
                bannerScrollRef.current?.scrollTo({ x: idx * screenWidth, animated: true });
                setCurrentBannerIndex(idx);
              }}
            >
              <View style={[
                styles.dot,
                currentBannerIndex === idx && styles.dotActive,
              ]} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Animated.FlatList
      data={filteredListings}
      keyExtractor={(item, index) => (item.id || item.Id || index).toString()}
      ListHeaderComponent={renderHeader}
      renderItem={renderFacebookStylePost}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      // Quyết định độ mượt: 1 = bắt sự kiện mọi khung hình (60 FPS)
      scrollEventThrottle={1}
      contentContainerStyle={{
        paddingTop: headerPadding, // Khoảng trống cho Header đè lên
        paddingBottom: 100, // Khoảng trống cho Bottom Bar đè lên
        backgroundColor: "#CED0D4",
      }}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh} 
          tintColor="#00A67E"
          colors={["#00A67E"]}
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  postContainer: { backgroundColor: "#fff", marginBottom: 8 },
  postHeader: { flexDirection: "row", padding: 12, alignItems: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#00A67E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  headerTextInfo: { flex: 1 },
  authorName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#050505",
    marginBottom: 2,
  },
  timeAndLocation: { fontSize: 12, color: "#65676B" },
  badgeWrapper: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: "bold" },
  postBodyText: { paddingHorizontal: 12, paddingBottom: 10 },
  postTitle: { fontSize: 15, color: "#050505", marginBottom: 4 },
  postPriceArea: { fontSize: 15, fontWeight: "bold", color: "#00A67E" },
  postImage: { width: "100%", height: 350, resizeMode: "cover" },
  imageCountOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  postActions: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    gap: 6,
  },
  actionText: { color: "#65676B", fontSize: 14, fontWeight: "600" },
  bannerContainer: {
    width: "100%",
    height: 220,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  bannerImage: { width: "100%", height: "100%", resizeMode: "cover" },
  bannerContent: {
    position: "absolute",
    bottom: 32,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
    borderRadius: 8,
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  bannerDesc: { color: "#eee", fontSize: 13 },
  dotsContainer: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00d4a0",
  },
});
