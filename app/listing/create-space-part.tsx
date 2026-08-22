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

export default function CreateSpacePartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parentSpaceId, id } = useLocalSearchParams();
  const isEditing = !!id;

  const [token, setToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parentSpace, setParentSpace] = useState<any>(null);
  const [existingPartsTotalArea, setExistingPartsTotalArea] = useState(0);

  // Images
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);

  // Basic info
  const [name, setName] = useState("");
  const [area, setArea] = useState("");

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

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    const loadAuth = async () => {
      const tk = await AsyncStorage.getItem("portal_token");
      setToken(tk);
    };
    loadAuth();
  }, []);

  // Fetch Parent Space Details to get area, latitude, longitude
  useEffect(() => {
    if (!parentSpaceId || !token) return;
    const fetchParentSpace = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/Space/GetById${parentSpaceId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          const data = await res.json();
          setParentSpace(data);
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin space gốc:", err);
      }
    };
    fetchParentSpace();
  }, [parentSpaceId, token]);

  // Fetch existing space parts to calculate area limit
  useEffect(() => {
    if (!parentSpaceId || !token) return;
    const fetchExistingParts = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/SpacePart/GetByParent/${parentSpaceId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          const data = await res.json();
          const parts = Array.isArray(data) ? data : data?.items || [];
          const totalArea = parts.reduce(
            (sum: number, p: any) => sum + (p.isActive && p.id !== Number(id) ? p.area : 0),
            0,
          );
          setExistingPartsTotalArea(totalArea);
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin space parts hiện tại:", err);
      }
    };
    fetchExistingParts();
  }, [parentSpaceId, token, id]);

  // Fetch SpacePart if Editing
  useEffect(() => {
    if (!isEditing || !token || !id) return;
    const fetchSpacePart = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/SpacePart/GetById/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setName(data.name || "");
          setArea(data.area ? String(data.area) : "");
          
          if (data.amenities && Array.isArray(data.amenities)) {
            setSelectedAmenities(data.amenities.map((a: any) => a.name));
          }
          if (data.spaceAllowedCategories && data.spaceAllowedCategories.length > 0) {
            setSelectedCategoryId(data.spaceAllowedCategories[0].bussinessCategoryId);
          }
          if (data.pictureURLs && Array.isArray(data.pictureURLs)) {
             setExistingImages(data.pictureURLs);
          }
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin không gian nhỏ:", err);
      }
    };
    fetchSpacePart();
  }, [id, token, isEditing]);

  // Fetch business categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/BussinessCategory/GetAll`);
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

  const toggleAmenity = (id: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets) {
        setSelectedImages((prev) => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.log(error);
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

  const handleSubmit = async () => {
    if (!name.trim() || !area.trim()) {
      return Alert.alert("Lỗi", "Vui lòng điền đủ tên và diện tích!");
    }

    if (!parentSpace) {
      return Alert.alert("Lỗi", "Chưa tải được thông tin mặt bằng gốc!");
    }

    const numArea = Number(area);
    const parentArea = Number(parentSpace.area) || 0;
    const availableArea = parentArea - existingPartsTotalArea;

    if (numArea > availableArea) {
      return Alert.alert(
        "Lỗi",
        `Diện tích không gian con (${numArea}m²) vượt quá diện tích còn lại của không gian gốc (${availableArea}m²).`,
      );
    }

    setIsSubmitting(true);

    const payload: any = {
      name: name.trim(),
      area: numArea,
      isActive: true,
      latitude: parentSpace.latitude || 0,
      longitude: parentSpace.longitude || 0,
      amenities: selectedAmenities.map((am) => ({
        name: am,
        quantity: 1,
        isActive: true,
      })),
      spaceAllowedCategories:
        selectedCategoryId !== ""
          ? [{ bussinessCategoryId: Number(selectedCategoryId) }]
          : [],
    };

    try {
      let endpoint = `${API_BASE}/api/SpacePart/Create/${parentSpaceId}`;
      let method = "POST";
      
      if (isEditing) {
        endpoint = `${API_BASE}/api/SpacePart/Update/${id}`;
        method = "PUT";
        payload.id = Number(id);
      }

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          accept: "*/*",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let errorMessage = errText;
        try {
          const errData = JSON.parse(errText);
          errorMessage = errData.message || errData.title || errText;
        } catch(e) {}
        
        const lowerErr = errorMessage.toLowerCase();
        if (lowerErr.includes("cannot exceed parent space area") || lowerErr.includes("diện tích") || lowerErr.includes("exceed")) {
          errorMessage = "Tổng diện tích các không gian chia nhỏ vượt quá diện tích không gian gốc.";
        } else if (lowerErr.includes("already been signed") || lowerErr.includes("already has an active contract")) {
          errorMessage = "Mặt bằng này đã được ký hợp đồng hoặc đang có người thuê nên không thể chia nhỏ.";
        }
        throw new Error(errorMessage || `Lỗi API: ${res.status}`);
      }

      const responseData = await res.json().catch(() => ({}));
      const createdSpaceId = isEditing ? id : (responseData.id || responseData.data?.id || responseData);

      // Upload new images
      if (selectedImages.length > 0 && createdSpaceId) {
        const formData = new FormData();
        selectedImages.forEach((file) => {
          formData.append("file", {
            uri: Platform.OS === "android" ? file.uri : file.uri.replace("file://", ""),
            type: file.mimeType || "image/jpeg",
            name: file.fileName || `image-${Date.now()}.jpg`,
          } as any);
        });
        formData.append("spaceId", createdSpaceId.toString());

        const picRes = await fetch(`${API_BASE}/api/Picture`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, accept: "*/*" },
          body: formData,
        });

        if (!picRes.ok) {
          console.error("Lỗi up ảnh SpacePart:", await picRes.text().catch(() => ""));
          Alert.alert("Cảnh báo", `Đã ${isEditing ? "cập nhật" : "tạo"} không gian thành công nhưng tải ảnh lên thất bại!`, [{ text: "OK", onPress: () => router.back() }]);
          return;
        }
      }

      Alert.alert(
        "Thành công",
        `Đã ${isEditing ? "cập nhật" : "tạo"} không gian nhỏ thành công!`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert("Lỗi", err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: "#0D1117" }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? "Sửa không gian chia nhỏ" : "Tạo không gian chia nhỏ"}</Text>
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
        <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tên không gian nhỏ *</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: Góc làm việc nhóm"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Diện tích (m²) *</Text>
          <TextInput
            style={styles.input}
            placeholder={`VD: Tối đa ${Math.max(0, (parentSpace?.area || 0) - existingPartsTotalArea)}`}
            keyboardType="numeric"
            value={area}
            onChangeText={(val) => setArea(val.replace(/[^\d]/g, ""))}
          />
        </View>

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

        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>{isEditing ? "Lưu thay đổi" : "Lưu không gian nhỏ"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn ngành nghề</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Feather name="x" size={22} color="#111827" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[
                { id: "", name: "Không (Không thiết lập)" },
                ...apiCategories,
              ]}
              keyExtractor={(item, idx) => `${item.id}-${idx}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedCategoryId(
                      item.id === "" ? "" : Number(item.id),
                    );
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>
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
  pickerText: { fontSize: 15, color: "#111827" },
  pickerPlaceholder: { fontSize: 15, color: "#9CA3AF" },

  pickImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 16,
  },
  pickImageText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#00A67E",
  },
  imagePreviewContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  imagePreviewWrapper: {
    marginRight: 12,
    position: "relative",
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  removeImageBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#EF4444",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

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
  amenityChipActive: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
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
});
