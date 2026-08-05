import { Stack } from 'expo-router';

export default function RootLayout() {
  // Tạm thời tháo logic check Token ra để bạn test thoải mái các nút điều hướng
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="listing/[id]" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}