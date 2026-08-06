import { useEffect, useState, useRef } from 'react';
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

  useEffect(() => {
    let newConnection: signalR.HubConnection;

    const connectHub = async () => {
      try {
        const token = await AsyncStorage.getItem('portal_token');
        if (!token) return;

        newConnection = new signalR.HubConnectionBuilder()
          .withUrl('https://flexi-space-capstone-project.onrender.com/notificationHub', {
            accessTokenFactory: () => token,
          })
          .withAutomaticReconnect()
          .build();

        newConnection.on('ReceiveNotification', (notification: NotificationMessage) => {
          setLatestNotification({ ...notification, _timestamp: Date.now() });
          setUnreadCount((prev) => prev + 1);
        });

        await newConnection.start();
        setConnection(newConnection);
        console.log('SignalR Connected!');
      } catch (err) {
        console.error('SignalR Connection Error: ', err);
      }
    };

    connectHub();

    return () => {
      if (newConnection) {
        newConnection.stop();
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
