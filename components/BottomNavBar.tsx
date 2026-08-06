import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

// 1. Thêm 'chat' vào type
export type BottomNavTab = 'home' | 'manage' | 'chat' | 'ai' | 'profile';

type BottomNavBarProps = {
  active: BottomNavTab;
  style?: any;
};

// 2. Thêm tab Tin nhắn vào mảng TABS
const TABS: { key: BottomNavTab; label: string; icon: keyof typeof Feather.glyphMap; path: string }[] = [
  { key: 'home', label: 'Trang chủ', icon: 'home', path: '/' },
  { key: 'manage', label: 'Quản lý', icon: 'briefcase', path: '/manage-spaces' },
  { key: 'chat', label: 'Tin nhắn', icon: 'message-circle', path: '/chat' },
  { key: 'ai', label: 'AI', icon: 'image', path: '/ai-editor' }, 
  { key: 'profile', label: 'Cá nhân', icon: 'user', path: '/profile' },
];

export const BottomNavBar = ({ active, style }: BottomNavBarProps) => {
  return (
    <Animated.View style={[styles.bottomBar, style]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => {
              if (!isActive) router.replace(tab.path as any);
            }}
          >
            <Feather name={tab.icon} size={22} color={isActive ? '#00A67E' : '#65676B'} />
            <Text style={[styles.tabText, isActive && { color: '#00A67E' }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  tabText: {
    fontSize: 10,
    marginTop: 2,
    color: '#65676B',
    fontWeight: '500',
  },
});