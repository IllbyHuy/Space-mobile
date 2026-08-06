import React, { createContext, useContext, ReactNode } from 'react';
import { useSignalR, NotificationMessage } from './useSignalR';

type NotificationContextType = {
  latestNotification: NotificationMessage | null;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const signalRState = useSignalR();

  return (
    <NotificationContext.Provider value={signalRState}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}
