import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// FILE FALLBACK - KHÔNG ĐƯỢC SỬ DỤNG THỰC TẾ.
// Metro yêu cầu phải có 1 file gốc không có platform-suffix
// đi kèm với MapContent.native.tsx và MapContent.web.tsx.
// Khi build, Metro sẽ luôn ưu tiên chọn file có suffix đúng platform,
// nên nội dung file này không ảnh hưởng đến app thực tế.

type Props = {
  listings?: any[];
};

export function MapContent(_props: Props) {
  return (
    <View style={styles.container}>
      <Text>Map placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});