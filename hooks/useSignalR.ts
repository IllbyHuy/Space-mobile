import { useEffect, useState, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import * as signalR from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationMessage = {
  title?: string;
  message?: string;
  type?: string;
  createdAt?: string;
  [key: string]: any;
};

export function useSignalR() {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [latestNotification, setLatestNotification] = useState<NotificationMessage | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    let isMounted = true;

    const connectHub = async () => {
      // Dừng connection cũ nếu có
      if (connectionRef.current) {
        await connectionRef.current.stop();
        connectionRef.current = null;
      }
      try {
        const token = await AsyncStorage.getItem('portal_token');
        if (!token) return;

        const newConnection = new signalR.HubConnectionBuilder()
          .withUrl('https://flexi-space-capstone-project.onrender.com/notificationHub', {
            accessTokenFactory: () => token,
          })
          .withAutomaticReconnect()
          .build();

        newConnection.on('ReceiveNotification', (notification: NotificationMessage) => {
          if (isMounted) {
            setLatestNotification({ ...notification, _timestamp: Date.now() });
            setUnreadCount((prev) => prev + 1);
          }
        });

        await newConnection.start();
        if (isMounted) {
          connectionRef.current = newConnection;
          setConnection(newConnection);
          console.log('SignalR Connected!');
        } else {
          newConnection.stop();
        }
      } catch (err) {
        console.warn('SignalR Connection Error (will retry): ', err);
        // Retry sau 5 giây nếu lỗi (render free tier sleep)
        if (isMounted) {
          setTimeout(() => {
            if (isMounted) connectHub();
          }, 5000);
        }
      }
    };

    connectHub();

    const authSubscription = DeviceEventEmitter.addListener('auth_changed', () => {
      connectHub();
    });

    return () => {
      isMounted = false;
      authSubscription.remove();
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
      }
    };
  }, []);

  return {
    connection,
    latestNotification,
    unreadCount,
    setUnreadCount,
  };
}
