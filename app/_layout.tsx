import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SettingsProvider, useSettings } from '../src/lib/settings';
import { useTheme } from '../src/lib/theme';

// No headers on Home, Facebook or YouTube — the site screens are full-screen.
// Settings keeps a normal header with a back button.
//
// The left-edge swipe on the site screens is the stack's built-in iOS back
// gesture; it follows his "swipe from left edge" setting.
//
// The site screens use slide_from_left (his pick, 2026-11-22): going home
// slides the site out to the left instead of the usual iOS right, and
// opening a site slides it in from the left to match — the animation
// applies to both directions, there's no exit-only setting.
function AppStack() {
  const theme = useTheme();
  const { settings } = useSettings();
  const leftEdge = settings.navLeftEdge;
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="facebook"
          options={{
            headerShown: false,
            gestureEnabled: leftEdge,
            animation: 'slide_from_left',
          }}
        />
        <Stack.Screen
          name="instagram"
          options={{
            headerShown: false,
            gestureEnabled: leftEdge,
            animation: 'slide_from_left',
          }}
        />
        <Stack.Screen
          name="marketplace"
          options={{
            headerShown: false,
            gestureEnabled: leftEdge,
            animation: 'slide_from_left',
          }}
        />
        <Stack.Screen
          name="youtube"
          options={{
            headerShown: false,
            gestureEnabled: leftEdge,
            animation: 'slide_from_left',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
            // Header mark: the icon-only logo beside the title
            // (Austin, 2026-11-23).
            headerTitle: () => (
              <View style={styles.headerTitle}>
                <Image
                  source={require('../assets/logo-mark.png')}
                  style={styles.headerMark}
                />
                <Text
                  style={[
                    styles.headerTitleText,
                    { color: theme.text },
                  ]}
                >
                  Settings
                </Text>
              </View>
            ),
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

const styles = StyleSheet.create({
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerMark: { width: 28, height: 28, borderRadius: 7 },
  headerTitleText: { fontSize: 17, fontWeight: '600' },
});
