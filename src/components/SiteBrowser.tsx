import { useRouter } from 'expo-router';
import React, { useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { FilterSettings } from '../lib/settings';
import { useSettings } from '../lib/settings';
import { useTheme } from '../lib/theme';

interface SiteBrowserProps {
  homeUrl: string;
  buildScript: (settings: FilterSettings) => string;
}

// One filtered site, full-screen: no header, no toolbar. The platform's real
// mobile site with the filter layer injected before content loads. Login
// cookies persist in the WebView, so signing in is a one-time thing per site.
//
// To get back home he swipes up on the bar at the bottom center — the same
// motion as the iPhone's home gesture, which iOS reserves for itself at the
// very edge of the screen, so the app's bar sits just above it. A tap on the
// bar works too.
export default function SiteBrowser({ homeUrl, buildScript }: SiteBrowserProps) {
  const { settings, loaded } = useSettings();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const webRef = useRef<WebView>(null);
  const swipedRef = useRef(false);

  // Rebuild (and remount) the WebView when the toggles change so the new
  // rules are the ones injected from the very first paint.
  const script = useMemo(() => buildScript(settings), [buildScript, settings]);

  const goHome = () => router.navigate('/');

  const grabber = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          swipedRef.current = false;
        },
        onPanResponderMove: (_, g) => {
          if (!swipedRef.current && g.dy <= -45) {
            swipedRef.current = true;
            goHome();
          }
        },
        onPanResponderRelease: (_, g) => {
          // A plain tap on the bar goes home too.
          if (!swipedRef.current && Math.abs(g.dy) < 8 && Math.abs(g.dx) < 8) {
            goHome();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top },
      ]}
    >
      <WebView
        key={script}
        ref={webRef}
        source={{ uri: homeUrl }}
        injectedJavaScriptBeforeContentLoaded={script}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        pullToRefreshEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
        renderLoading={() => (
          <View
            style={[styles.loading, { backgroundColor: theme.background }]}
          >
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}
      />
      <View style={styles.grabberZone} {...grabber.panHandlers}>
        <View
          style={[styles.grabberPill, { backgroundColor: theme.grabber }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A small touch target at the bottom center, over the site's own bottom
  // bar — the pill is drawn at the same spot as the iPhone home indicator.
  grabberZone: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: 180,
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 9,
  },
  grabberPill: {
    width: 134,
    height: 5,
    borderRadius: 3,
  },
});
