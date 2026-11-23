import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SettingsProvider } from '../src/lib/settings';
import { useTheme } from '../src/lib/theme';

// No headers on Home, Facebook or YouTube — the site screens are full-screen
// and he swipes up from the bottom to get back home. Settings keeps a normal
// header with a back button.
export default function RootLayout() {
  const theme = useTheme();
  return (
    <SettingsProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="facebook" options={{ headerShown: false }} />
        <Stack.Screen name="youtube" options={{ headerShown: false }} />
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
    </SettingsProvider>
  );
}
