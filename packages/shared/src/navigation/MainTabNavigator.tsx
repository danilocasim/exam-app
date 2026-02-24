// MainTabNavigator — Bottom tab navigation with 4 tabs: Home, Practice, History, Stats
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, ClipboardList, BookOpen, BarChart2 } from 'lucide-react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { PracticeSetupScreen } from '../screens/PracticeSetupScreen';
import { ExamHistoryScreen } from '../screens/ExamHistoryScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';

// AWS Modern Color Palette (consistent with existing theme)
const colors = {
  background: '#232F3E',
  surface: '#1F2937',
  borderDefault: '#374151',
  textMuted: '#9CA3AF',
  textHeading: '#F9FAFB',
  primaryOrange: '#FF9900',
};

export type MainTabParamList = {
  HomeTab: undefined;
  PracticeTab: undefined;
  HistoryTab: undefined;
  StatsTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      id="MainTabs"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryOrange,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderDefault,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
          height: 56 + Math.max(insets.bottom, 10),
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size - 2} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="PracticeTab"
        component={PracticeSetupScreen}
        options={{
          tabBarLabel: 'Practice',
          tabBarIcon: ({ color, size }) => (
            <ClipboardList size={size - 2} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={ExamHistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => (
            <BookOpen size={size - 2} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="StatsTab"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: 'Stats',
          tabBarIcon: ({ color, size }) => (
            <BarChart2 size={size - 2} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
