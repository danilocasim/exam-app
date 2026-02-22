// React Navigation setup
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// Import actual screens (T041, T042, T046, T053, T054, T058)
import {
  HomeScreen,
  ExamScreen,
  ExamResultsScreen,
  PracticeSetupScreen,
  PracticeScreen,
  PracticeSummaryScreen,
  AnalyticsScreen,
  CloudAnalyticsScreen,
} from '../screens';

// Color constants matching the app theme
const colors = {
  slate950: '#020617',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate400: '#94a3b8',
  white: '#ffffff',
  orange500: '#f97316',
};

// Navigation param types
export type RootStackParamList = {
  // Home screen
  Home: undefined;

  // Exam flow screens
  ExamScreen: { resumeAttemptId?: string };
  ExamResults: { attemptId: string };

  // Practice flow screens
  PracticeSetup: undefined;
  PracticeScreen: { sessionId: string };
  PracticeSummary: { sessionId: string };

  // Review flow screens
  ExamHistory: undefined;
  ReviewScreen: { attemptId: string };

  // Analytics
  Analytics: undefined;
  CloudAnalytics: undefined;

  // Auth
  Auth: undefined;

  // Settings
  Settings: undefined;
};

// Create the stack navigator
const Stack = createNativeStackNavigator<RootStackParamList>();

// Placeholder screens (remaining screens to be implemented)
const PlaceholderScreen: React.FC<{ name: string }> = ({ name }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🚧</Text>
      </View>
      <Text style={styles.text}>{name}</Text>
      <Text style={styles.subtext}>Coming Soon</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.slate950,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: colors.slate900,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.slate800,
  },
  icon: {
    fontSize: 40,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
  },
  subtext: {
    fontSize: 14,
    color: colors.slate400,
    marginTop: 8,
  },
});

// Review screens imported from ../screens (T061, T062)
import { ExamHistoryScreen } from '../screens/ExamHistoryScreen';
import { ReviewScreen } from '../screens/ReviewScreen';

// Settings screen (T107)
import { SettingsScreen } from '../screens/SettingsScreen';

// Auth screen (T134)
import { AuthScreen } from '../screens/AuthScreen';

/**
 * Root navigation component
 * Wraps the app in NavigationContainer and defines all screens
 */
export const RootNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.slate900,
          },
          headerTintColor: colors.white,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: colors.slate950,
          },
          animation: 'slide_from_right',
        }}
      >
        {/* Home - no header, custom header in screen */}
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />

        {/* Exam Flow - no headers, custom UI */}
        <Stack.Screen
          name="ExamScreen"
          component={ExamScreen}
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="ExamResults"
          component={ExamResultsScreen}
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />

        {/* Practice Flow */}
        <Stack.Screen
          name="PracticeSetup"
          component={PracticeSetupScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PracticeScreen"
          component={PracticeScreen}
          options={{
            title: 'Practice',
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="PracticeSummary"
          component={PracticeSummaryScreen}
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />

        {/* Review Flow */}
        <Stack.Screen
          name="ExamHistory"
          component={ExamHistoryScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ReviewScreen"
          component={ReviewScreen}
          options={{ headerShown: false }}
        />

        {/* Analytics */}
        <Stack.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{ headerShown: false }}
        />

        {/* Cloud Analytics (T142) */}
        <Stack.Screen
          name="CloudAnalytics"
          component={CloudAnalyticsScreen}
          options={{ headerShown: false }}
        />

        {/* Auth (T134) */}
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />

        {/* Settings */}
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Export navigation types for use in screens
export type { NativeStackNavigationProp } from '@react-navigation/native-stack';
export type { RouteProp } from '@react-navigation/native';
