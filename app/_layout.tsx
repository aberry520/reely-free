import { Stack } from 'expo-router';
import React from 'react';
import { SettingsProvider } from '../src/lib/settings';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Reely Free' }} />
        <Stack.Screen name="facebook" options={{ title: 'Facebook' }} />
        <Stack.Screen name="youtube" options={{ title: 'YouTube' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </SettingsProvider>
  );
}
