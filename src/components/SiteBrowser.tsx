import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
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

const BTN = 50;
const BTN_POS_KEY = 'reelyfree-homebtn-v1';

// One filtered site, full-screen: no header, no toolbar. The platform's real
// mobile site with the filter layer injected before content loads. Login
// cookies persist in the WebView, so signing in is a one-time thing per site.
//
// Getting home: the iOS left-edge swipe (the stack's built-in back gesture)
// works, and a translucent floating home button is always on screen. The
// button can be dragged anywhere and snaps to the nearest side; its spot is
// remembered across both sites. A tap on it goes home.
export default function SiteBrowser({ homeUrl, buildScript }: SiteBrowserProps) {
  const { settings, loaded } = useSettings();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const webRef = useRef<WebView>(null);

  // Rebuild (and remount) the WebView when the toggles change so the new
  // rules are the ones injected from the very first paint.
  const script = useMemo(() => buildScript(settings), [buildScript, settings]);

  const goHome = () => router.navigate('/');

  // --- Draggable floating home button -------------------------------------
  const win = Dimensions.get('window');
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const posRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [btnReady, setBtnReady] = useState(false);

  useEffect(() => {
    const fallback = {
      x: win.width - BTN - 16,
      y: win.height - BTN - 140,
    };
    AsyncStorage.getItem(BTN_POS_KEY)
      .then((raw) => {
        let pos = fallback;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { x?: number; y?: number };
            if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
              pos = {
                x: Math.min(Math.max(parsed.x, 0), win.width - BTN),
                y: Math.min(Math.max(parsed.y, 0), win.height - BTN),
              };
            }
          } catch {
            // Corrupt saved position: use the fallback.
          }
        }
        posRef.current = pos;
        pan.setValue(pos);
        setBtnReady(true);
      })
      .catch(() => {
        posRef.current = fallback;
        pan.setValue(fallback);
        setBtnReady(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const btnPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...posRef.current };
        },
        onPanResponderMove: (_, g) => {
          pan.setValue({
            x: dragStartRef.current.x + g.dx,
            y: dragStartRef.current.y + g.dy,
          });
        },
        onPanResponderRelease: (_, g) => {
          if (Math.hypot(g.dx, g.dy) < 8) {
            goHome();
            return;
          }
          const movedX = dragStartRef.current.x + g.dx;
          const movedY = dragStartRef.current.y + g.dy;
          const maxY = win.height - insets.top - BTN - 16;
          const target = {
            x:
              movedX + BTN / 2 < win.width / 2
                ? 12
                : win.width - BTN - 12,
            y: Math.min(Math.max(movedY, 8), maxY),
          };
          posRef.current = target;
          Animated.spring(pan, {
            toValue: target,
            useNativeDriver: false,
            friction: 7,
          }).start();
          AsyncStorage.setItem(BTN_POS_KEY, JSON.stringify(target)).catch(
            () => {},
          );
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
      {btnReady && (
        <Animated.View
          {...btnPan.panHandlers}
          accessibilityLabel="Go home"
          style={[
            styles.homeBtn,
            {
              backgroundColor: theme.homeBtnBg,
              transform: pan.getTranslateTransform(),
            },
          ]}
        >
          <Text style={[styles.homeBtnGlyph, { color: theme.homeBtnGlyph }]}>
            ⌂
          </Text>
        </Animated.View>
      )}
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
  homeBtn: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  homeBtnGlyph: {
    fontSize: 27,
    lineHeight: 30,
    marginTop: -3,
  },
});
