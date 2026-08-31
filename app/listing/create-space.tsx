import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  FlatList,
  Platform,
  Image,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

const API_BASE = "https://flexi-space-capstone-project.onrender.com";

const AMENITIES_IDS = ["wifi", "ac", "parking", "wc", "projector", "sound"];
const AMENITY_LABELS: Record<string, string> = {
  wifi: "Wifi",
  ac: "Máy lạnh",
  parking: "Bãi đỗ xe",
  wc: "Nhà vệ sinh",
  projector: "Máy chiếu",
  sound: "Âm thanh",
};

const DAYS_OF_WEEK = [
  { id: 2, label: "Thứ 2" },
  { id: 3, label: "Thứ 3" },
  { id: 4, label: "Thứ 4" },
  { id: 5, label: "Thứ 5" },
  { id: 6, label: "Thứ 6" },
  { id: 7, label: "Thứ 7" },
  { id: 0, label: "CN" },
];

export default function CreateSpaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const isEditing = !!id;

  const [token, setToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Basic info
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");

  const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);

  // original city string when editing
  const [originalCity, setOriginalCity] = useState("");

  // Address cascade: Province -> District -> Ward
  const [provinces, setProvinces] = useState<
    { value: string; label: string }[]
  >([]);
  const [districts, setDistricts] = useState<
    { value: string; label: string }[]
  >([]);
  const [wards, setWards] = useState<{ value: string; label: string }[]>([]);

  const [provinceCode, setProvinceCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [wardCode, setWardCode] = useState("");

  const [provinceLabel, setProvinceLabel] = useState("");
  const [districtLabel, setDistrictLabel] = useState("");
  const [wardLabel, setWardLabel] = useState("");

  // Amenities
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState("");

  const addCustomAmenity = () => {
    const val = customAmenity.trim();
    if (val && !selectedAmenities.includes(val)) {
      setSelectedAmenities([...selectedAmenities, val]);
    }
    setCustomAmenity("");
  };

  // Business categories
  const [apiCategories, setApiCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "">("");

  // Picker modals
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [showWardPicker, setShowWardPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const pickImage = async () => {
    if (Platform.OS === 'web') {
      const useCamera = window.confirm("Bạn muốn chụp ảnh mới? (OK = Chụp ảnh, Cancel = Chọn từ thư viện)");
      if (useCamera) {
        let result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.8,
        });
        if (!result.canceled) {
          setSelectedImages((prev) => [...prev, ...result.assets]);
        }
      } else {
        let result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          quality: 0.8,
        });
        if (!result.canceled) {
          setSelectedImages((prev) => [...prev, ...result.assets]);
        }
      }
    } else {
      Alert.alert(
        "Thêm ảnh",
        "Chọn nguồn ảnh",
        [
          { text: "Hủy", style: "cancel" },
          { text: "Chụp ảnh", onPress: async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert("Lỗi", "Cần cấp quyền camera để chụp ảnh!");
                return;
              }
              let result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
              });
              if (!result.canceled) {
                setSelectedImages((prev) => [...prev, ...result.assets]);
              }
            }
          },
          { text: "Chọn từ thư viện", onPress: async () => {
              let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
              });
              if (!result.canceled) {
                setSelectedImages((prev) => [...prev, ...result.assets]);
              }
            }
          }
        ]
      );
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = async (index: number) => {
    const imgToRemove = existingImages[index];
    const publicId = imgToRemove?.publicId || imgToRemove?.id || imgToRemove;

    if (publicId) {
      try {
        const res = await fetch(`${API_BASE}/api/Picture/${publicId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            accept: "*/*",
          },
        });

        if (res.ok) {
          setExistingImages((prev) => prev.filter((_, i) => i !== index));
        } else {
          Alert.alert("Lỗi", "Không thể xóa ảnh này trên hệ thống!");
        }
      } catch (err) {
        Alert.alert("Lỗi", "Đã xảy ra lỗi khi xóa ảnh");
      }
    } else if (typeof imgToRemove === 'string') {
      setExistingImages((prev) => prev.filter((_, i) => i !== index));
    }
  };

  useEffect(() => {
    const loadAuth = async () => {
      const tk = await AsyncStorage.getItem("portal_token");
      setToken(tk);
    };
    loadAuth();
  }, []);

  // Fetch provinces on mount
  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/Space/GetAddress`, {
          headers: { accept: "*/*" },
        });
        if (res.ok) {
          const data = await res.json();
          setProvinces(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách tỉnh/thành:", err);
      }
    };
    fetchProvinces();
  }, []);

  // Fetch business categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/BussinessCategory/GetAll`, {
          headers: { accept: "*/*" },
        });
        if (res.ok) {
          const data = await res.json();
          setApiCategories(Array.isArray(data) ? data : data?.items || []);
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách ngành nghề:", err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch space if editing
  useEffect(() => {
    if (!isEditing || !token) return;

    const fetchSpace = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/Space/GetById${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setName(data.name || "");
          setAddress(data.address || "");
          setArea(data.area ? String(data.area) : "");
          setOriginalCity(data.city || "");
          setProvinceLabel(data.city || "");

          if (data.amenities) {
            setSelectedAmenities(data.amenities.map((a: any) => a.name));
          }

          if (
            data.spaceAllowedCategories &&
            data.spaceAllowedCategories.length > 0
          ) {
            setSelectedCategoryId(
              data.spaceAllowedCategories[0].bussinessCategoryId,
            );
          }

          if (data.pictureURLs && Array.isArray(data.pictureURLs)) {
             setExistingImages(data.pictureURLs);
          } else if (data.pictures && Array.isArray(data.pictures)) {
             setExistingImages(data.pictures);
          } else if (data.spacePictures && Array.isArray(data.spacePictures)) {
             setExistingImages(data.spacePictures);
          }
        }
      } catch (err) {
        console.error("Lỗi lấy dữ liệu mặt bằng:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSpace();
  }, [id, token, isEditing]);

  const handleProvinceSelect = async (item: {
    value: string;
    label: string;
  }) => {
    setProvinceCode(item.value);
    setProvinceLabel(item.label);
    setDistrictCode("");
    setDistrictLabel("");
    setWardCode("");
    setWardLabel("");
    setDistricts([]);
    setWards([]);
    setShowProvincePicker(false);

    try {
      const res = await fetch(
        `${API_BASE}/api/Space/GetAddress?provinceCode=${encodeURIComponent(item.value)}`,
        { headers: { accept: "*/*" } },
      );
      if (res.ok) {
        const data = await res.json();
        setDistricts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách quận/huyện:", err);
    }
  };

  const handleDistrictSelect = async (item: {
    value: string;
    label: string;
  }) => {
    setDistrictCode(item.value);
    setDistrictLabel(item.label);
    setWardCode("");
    setWardLabel("");
    setWards([]);
    setShowDistrictPicker(false);

    try {
      const res = await fetch(
        `${API_BASE}/api/Space/GetAddress?provinceCode=${encodeURIComponent(provinceCode)}&districtCode=${encodeURIComponent(item.value)}`,
        { headers: { accept: "*/*" } },
      );
      if (res.ok) {
        const data = await res.json();
        setWards(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách phường/xã:", err);
    }
  };

  const handleWardSelect = (item: { value: string; label: string }) => {
    setWardCode(item.value);
    setWardLabel(item.label);
    setShowWardPicker(false);
  };

  const toggleAmenity = (id: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (!name.trim() || !address.trim() || !area.trim()) {
      return Alert.alert("Lỗi", "Vui lòng điền đủ tên, địa chỉ và diện tích!");
    }

    if (!isEditing && !provinceCode) {
      return Alert.alert("Lỗi", "Vui lòng chọn Tỉnh/Thành phố!");
    }

    setIsSubmitting(true);

    const lat = 0;
    const lng = 0;

    const newCity = [wardLabel, districtLabel, provinceLabel]
      .filter(Boolean)
      .join(", ");
    const finalCity =
      isEditing && !wardLabel && !districtLabel ? originalCity : newCity;

    const payload = {
      name: name.trim(),
      address: address.trim(),
      city: finalCity,
      area: Number(area) || 0,
      isActive: true,
      latitude: lat,
      longitude: lng,
      amenities: selectedAmenities.map((am) => ({
        name: am,
        quantity: 1,
        isActive: true,
      })),
      spaceAllowedCategories:
        selectedCategoryId !== ""
          ? [{ bussinessCategoryId: selectedCategoryId }]
          : [],
    };

    try {
      const url = isEditing
        ? `${API_BASE}/api/Space/Update${id}`
        : `${API_BASE}/api/Space/Create`;

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          accept: "*/*",
        },
        body: JSON.stringify(isEditing ? { ...payload, id } : payload),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error("Space Error:", res.status, errBody);
        throw new Error(
          `Không thể ${isEditing ? "cập nhật" : "tạo"} mặt bằng. Kiểm tra lại thông tin!`,
        );
      }

      const resText = await res.text();
      let createdSpaceId = id; // Fallback to id if editing
      try {
        const resData = JSON.parse(resText);
        createdSpaceId = resData.id || resData.data?.id || resData || id;
      } catch {
        createdSpaceId = resText || id;
      }

      if (selectedImages.length > 0 && createdSpaceId) {
        const formData = new FormData();
        for (let i = 0; i < selectedImages.length; i++) {
          const img = selectedImages[i];
          if (Platform.OS === 'web') {
            const fetchRes = await fetch(img.uri);
            const blob = await fetchRes.blob();
            formData.append('file', blob, img.fileName || `image_${i}.jpg`);
          } else {
            const filename = img.fileName || img.uri.split('/').pop() || `image_${i}.jpg`;
            const type = img.mimeType || 'image/jpeg';
            formData.append('file', {
              uri: img.uri,
              name: filename,
              type,
            } as any);
          }
        }
        formData.append('spaceId', createdSpaceId.toString());

        const picRes = await fetch(`${API_BASE}/api/Picture`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            accept: '*/*',
          },
          body: formData,
        });

        if (!picRes.ok) {
          console.error('Lỗi up ảnh:', await picRes.text().catch(() => ''));
          Alert.alert('Cảnh báo', `Đã ${isEditing ? "cập nhật" : "tạo"} mặt bằng thành công nhưng tải ảnh lên thất bại!`, [{ text: 'OK', onPress: () => router.back() }]);
          return;
        }
      }

      Alert.alert(
        "Thành công",
        `Đã ${isEditing ? "cập nhật" : "tạo"} mặt bằng thành công!`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert("Lỗi", err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generic picker modal
  const renderPickerModal = (
    visible: boolean,
    setVisible: (v: boolean) => void,
    title: string,
    items: { value: string; label: string }[],
    onSelect: (item: { value: string; label: string }) => void,
  ) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Feather name="x" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={items}
            keyExtractor={(item, idx) => `${item.value}-${idx}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => onSelect(item)}
              >
                <Text style={styles.modalItemText}>{item.label}</Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 400 }}
          />
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#00A67E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: "#0D1117" }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? "Sửa mặt bằng" : "Đăng ký mặt bằng"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* === THÔNG TIN CƠ BẢN === */}
        <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tên mặt bằng *</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: Văn phòng tầng 3"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Province */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tỉnh/Thành *</Text>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setShowProvincePicker(true)}
          >
            <Text
              style={
                provinceLabel ? styles.pickerText : styles.pickerPlaceholder
              }
            >
              {provinceLabel || "-- Chọn Tỉnh/Thành --"}
            </Text>
            <Feather name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* District */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Quận/Huyện *</Text>
          <TouchableOpacity
            style={[
              styles.pickerBtn,
              !provinceCode && !isEditing && styles.pickerDisabled,
            ]}
            onPress={() =>
              (provinceCode || isEditing) && setShowDistrictPicker(true)
            }
            disabled={!provinceCode && !isEditing}
          >
            <Text
              style={
                districtLabel ? styles.pickerText : styles.pickerPlaceholder
              }
            >
              {districtLabel || "-- Chọn Quận/Huyện --"}
            </Text>
            <Feather name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Ward */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phường/Xã *</Text>
          <TouchableOpacity
            style={[
              styles.pickerBtn,
              !districtCode && !isEditing && styles.pickerDisabled,
            ]}
            onPress={() =>
              (districtCode || isEditing) && setShowWardPicker(true)
            }
            disabled={!districtCode && !isEditing}
          >
            <Text
              style={wardLabel ? styles.pickerText : styles.pickerPlaceholder}
            >
              {wardLabel || "-- Chọn Phường/Xã --"}
            </Text>
            <Feather name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Street address */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Địa chỉ (Số nhà, tên đường) *</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: 120 Lê Lợi"
            value={address}
            onChangeText={setAddress}
          />
        </View>

        {/* Area */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Diện tích (m²) *</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: 50"
            keyboardType="numeric"
            value={area}
            onChangeText={(val) => setArea(val.replace(/[^\d]/g, ""))}
          />
        </View>

        {/* === TIỆN ÍCH === */}
        <Text style={styles.sectionTitle}>Tiện ích (Tuỳ chọn)</Text>
        <View style={styles.amenitiesGrid}>
          {AMENITIES_IDS.map((id) => {
            const isChecked = selectedAmenities.includes(id);
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.amenityChip,
                  isChecked && styles.amenityChipActive,
                ]}
                onPress={() => toggleAmenity(id)}
              >
                <Feather
                  name={isChecked ? "check-square" : "square"}
                  size={16}
                  color={isChecked ? "#00A67E" : "#9CA3AF"}
                />
                <Text
                  style={[
                    styles.amenityText,
                    isChecked && styles.amenityTextActive,
                  ]}
                >
                  {AMENITY_LABELS[id]}
                </Text>
              </TouchableOpacity>
            );
          })}
          {selectedAmenities.filter(a => !AMENITIES_IDS.includes(a)).map((custom) => (
            <TouchableOpacity
              key={custom}
              style={[styles.amenityChip, styles.amenityChipActive]}
              onPress={() => toggleAmenity(custom)}
            >
              <Feather name="check-square" size={16} color="#00A67E" />
              <Text style={[styles.amenityText, styles.amenityTextActive]}>
                {custom}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.inputGroup, { flexDirection: 'row', alignItems: 'center', marginTop: 12 }]}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Nhập tiện ích khác..."
            value={customAmenity}
            onChangeText={setCustomAmenity}
            onSubmitEditing={addCustomAmenity}
          />
          <TouchableOpacity 
            style={{ marginLeft: 8, backgroundColor: '#00A67E', padding: 12, borderRadius: 8 }}
            onPress={addCustomAmenity}
          >
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* === NGÀNH NGHỀ === */}
        <Text style={styles.sectionTitle}>Ngành nghề cho phép (Tuỳ chọn)</Text>
        <View style={styles.inputGroup}>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setShowCategoryPicker(true)}
          >
            <Text
              style={
                selectedCategoryId !== ""
                  ? styles.pickerText
                  : styles.pickerPlaceholder
              }
            >
              {selectedCategoryId !== ""
                ? apiCategories.find((c) => c.id === selectedCategoryId)
                    ?.name || "Đã chọn"
                : "Không (Không thiết lập)"}
            </Text>
            <Feather name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Hình ảnh mặt bằng */}
        <Text style={styles.sectionTitle}>Hình ảnh mặt bằng (Tùy chọn)</Text>
        <TouchableOpacity style={styles.pickImageBtn} onPress={pickImage}>
          <Feather name="image" size={20} color="#00A67E" />
          <Text style={styles.pickImageText}>Chọn ảnh từ thư viện</Text>
        </TouchableOpacity>

        {(existingImages.length > 0 || selectedImages.length > 0) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewContainer}>
            {existingImages.map((img, idx) => {
              const url = typeof img === 'string' ? img : (img.imageUrl || img.url || img.pictureUrl);
              return (
                <View key={`existing-${idx}`} style={styles.imagePreviewWrapper}>
                  <Image source={{ uri: url }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeExistingImage(idx)}>
                    <Feather name="x" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              );
            })}
            {selectedImages.map((img, idx) => (
              <View key={`new-${idx}`} style={styles.imagePreviewWrapper}>
                <Image source={{ uri: img.uri }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(idx)}>
                  <Feather name="x" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* SUBMIT */}
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {isEditing ? "Lưu thay đổi" : "Lưu mặt bằng"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Picker Modals */}
      {renderPickerModal(
        showProvincePicker,
        setShowProvincePicker,
        "Chọn Tỉnh/Thành",
        provinces,
        handleProvinceSelect,
      )}
      {renderPickerModal(
        showDistrictPicker,
        setShowDistrictPicker,
        "Chọn Quận/Huyện",
        districts,
        handleDistrictSelect,
      )}
      {renderPickerModal(
        showWardPicker,
        setShowWardPicker,
        "Chọn Phường/Xã",
        wards,
        handleWardSelect,
      )}
      {renderPickerModal(
        showCategoryPicker,
        setShowCategoryPicker,
        "Chọn ngành nghề",
        [
          { value: "", label: "Không (Không thiết lập)" },
          ...apiCategories.map((c: any) => ({
            value: String(c.id),
            label: c.name,
          })),
        ],
        (item) => {
          setSelectedCategoryId(item.value === "" ? "" : Number(item.value));
          setShowCategoryPicker(false);
        },
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
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
  scrollContent: { flex: 1 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 20,
    marginBottom: 8,
  },
  sectionDesc: { fontSize: 13, color: "#6B7280", marginBottom: 12 },

  inputGroup: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },

  pickerBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerDisabled: { opacity: 0.5 },
  pickerText: { fontSize: 15, color: "#111827" },
  pickerPlaceholder: { fontSize: 15, color: "#9CA3AF" },

  amenitiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  amenityChipActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  amenityText: { fontSize: 14, color: "#6B7280" },
  amenityTextActive: { color: "#065F46", fontWeight: "500" },

  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dayToggle: { flexDirection: "row", alignItems: "center", gap: 8 },
  dayLabel: { fontSize: 14, fontWeight: "600", color: "#334155", width: 50 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: "#111827",
    width: 65,
    textAlign: "center",
  },
  timeSep: { color: "#94A3B8", fontSize: 16 },

  submitBtn: {
    backgroundColor: "#00A67E",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 30,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: { fontSize: 17, fontWeight: "bold", color: "#111827" },
  modalItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  modalItemText: { fontSize: 15, color: "#374151" },
  
  pickImageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
    borderStyle: 'dashed', borderRadius: 8, padding: 16, marginBottom: 12, gap: 8
  },
  pickImageText: { color: '#00A67E', fontWeight: '500' },
  imagePreviewContainer: { flexDirection: 'row', marginBottom: 16 },
  imagePreviewWrapper: { marginRight: 12, position: 'relative' },
  imagePreview: { width: 80, height: 80, borderRadius: 8 },
  removeImageBtn: {
    position: 'absolute', top: -6, right: -6, backgroundColor: 'red',
    borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff'
  },
});
