import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SettingsProvider, useSettings } from '../src/lib/settings';
import { useTheme } from '../src/lib/theme';

// No headers on Home, Facebook or YouTube — the site screens are full-screen.
// Settings keeps a normal header with a back button.
//
// The left-edge swipe on the site screens is the stack's built-in iOS back
// gesture; it follows his "swipe from left edge" setting.
function AppStack() {
  const theme = useTheme();
  const { settings } = useSettings();
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="facebook"
          options={{
            headerShown: false,
            gestureEnabled: settings.navLeftEdge,
          }}
        />
        <Stack.Screen
          name="youtube"
          options={{
            headerShown: false,
            gestureEnabled: settings.navLeftEdge,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AppStack />
    </SettingsProvider>
  );
}
