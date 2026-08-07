import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        saveTokenToBackend(token);
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log(response);
      // Handle notification tap here (e.g., navigate to specific screen)
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const saveTokenToBackend = async (pushToken: string) => {
    try {
      const accessToken = await AsyncStorage.getItem('portal_token');
      if (!accessToken) return; // Chỉ gửi token nếu đã đăng nhập

      const platform = Platform.OS; // 'ios' hoặc 'android'

      const response = await fetch('https://flexi-space-capstone-project.onrender.com/api/Notification/save-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          token: pushToken,
          platform: platform
        })
      });

      if (!response.ok) {
        console.error('Failed to save push token to backend');
      }
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  };

  return {
    expoPushToken,
    notification,
  };
}

export async function forceRegisterAndSavePushToken() {
  const token = await registerForPushNotificationsAsync();
  if (token) {
    try {
      const accessToken = await AsyncStorage.getItem('portal_token');
      if (!accessToken) return;

      const platform = Platform.OS;
      await fetch('https://flexi-space-capstone-project.onrender.com/api/Notification/save-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ token, platform })
      });
    } catch (error) {
      console.error('Error saving push token manually:', error);
    }
  }
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      // Handle error if projectId cannot be found
      console.log("Error getting push token", e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
