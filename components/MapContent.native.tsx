import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Callout } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

const getUrl = (img: any) =>
  typeof img === 'string'
    ? img
    : img?.imageUrl || img?.url || 'https://images.unsplash.com/photo-1556761175-5973dc0f32d7?auto=format&fit=crop&q=80&w=400';

type Props = {
  listings: any[];
};

export function MapContent({ listings }: Props) {
  const router = useRouter();

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: 10.7769,
        longitude: 106.7,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {listings.map((p, index) => {
        let unitDisplay = 'Giờ';
        if (p.priceUnit === 'PerDay') unitDisplay = 'Ngày';
        else if (p.priceUnit === 'PerWeek') unitDisplay = 'Tuần';
        else if (p.priceUnit === 'PerMonth') unitDisplay = 'Tháng';
        else if (p.priceUnit === 'PerYear') unitDisplay = 'Năm';

        return (
          <Marker
            key={p.id || p.Id || index}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            pinColor="#E03C31"
          >
            <Callout tooltip onPress={() => router.push(`/listing/${p.id || p.Id}`)}>
              <View style={styles.calloutContainer}>
                <View style={styles.calloutImageWrapper}>
                  <Image
                    source={{ uri: p.listingPictures?.[0] ? getUrl(p.listingPictures[0]) : getUrl(null) }}
                    style={styles.calloutImage}
                    resizeMode="cover"
                  />
                </View>

                <View style={styles.calloutInfo}>
                  <Text style={styles.calloutPrice}>
                    {p.price ? `${p.price.toLocaleString('vi-VN')} đ/${unitDisplay}` : 'Thỏa thuận'}
                  </Text>
                  <Text style={styles.calloutName} numberOfLines={2}>
                    {p.name || p.description || 'Mặt bằng cho thuê'}
                  </Text>
                  <Text style={styles.calloutSub}>
                    {p.area ? `${p.area} m² • ` : ''}{(p.spaceCity || p.spaceAddress || 'TP.HCM').substring(0, 30)}
                  </Text>
                </View>
              </View>
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: width,
    height: height,
  },
  calloutContainer: {
    width: 220,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    elevation: 4,
    marginBottom: 8,
  },
  calloutImageWrapper: {
    width: '100%',
    height: 120,
    backgroundColor: '#E5E7EB',
  },
  calloutImage: {
    width: '100%',
    height: '100%',
  },
  calloutInfo: {
    padding: 10,
  },
  calloutPrice: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 4,
  },
  calloutName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 18,
  },
  calloutSub: {
    fontSize: 12,
    color: '#6B7280',
  },
});