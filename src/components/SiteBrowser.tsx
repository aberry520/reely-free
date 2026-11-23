import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
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
  // URL fragments where pull-to-refresh is disabled — e.g. YouTube watch
  // pages, where a downward drag means "go back", not "reload".
  noRefreshPaths?: string[];
  // Override the WebView user agent — the guest Marketplace door asks for
  // the desktop site, which treats logged-out visitors differently.
  userAgent?: string;
  // Non-persistent WebView session: cookies/cache are not shared with the
  // other doors, so the guest door never touches his Facebook login.
  incognito?: boolean;
  // Show a "Reset guest" pill that remounts the WebView fresh — the known
  // recovery when Facebook's login wall stops being dismissible.
  resettable?: boolean;
  // URL fragments that must never load (e.g. Facebook's login/signup
  // pages on the guest door, where signing in is not the point).
  blockUrlFragments?: string[];
}

const BTN = 50;
const BTN_POS_KEY = 'reelyfree-homebtn-v1';

// One filtered site, full-screen: no header, no toolbar. The platform's real
// mobile site with the filter layer injected before content loads. Login
// cookies persist in the WebView, so signing in is a one-time thing per site.
//
// Getting home — each way is individually toggleable in Settings:
// - left-edge swipe: the stack's built-in iOS back gesture (see _layout)
// - right-edge swipe: a thin zone on the right edge, swipe left to go home
// - bottom swipe: a bar at the bottom center (iOS often steals this one)
// - the translucent floating home button: draggable anywhere, snaps to the
//   nearest side, remembers its spot across both sites; a tap goes home
// If he turns all four off, the button stays anyway as a fallback so a site
// screen can never become a dead end.
export default function SiteBrowser({
  homeUrl,
  buildScript,
  noRefreshPaths,
  userAgent,
  incognito,
  resettable,
  blockUrlFragments,
}: SiteBrowserProps) {
  const { settings, loaded } = useSettings();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const webRef = useRef<WebView>(null);

  // Rebuild (and remount) the WebView when the toggles change so the new
  // rules are the ones injected from the very first paint.
  const script = useMemo(() => buildScript(settings), [buildScript, settings]);

  const goHome = () => router.navigate('/');

  // In-page back (e.g. from a video back to the feed): the button only
  // appears when the WebView actually has somewhere to go back to. The
  // current URL is tracked too, for pull-to-refresh rules.
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(homeUrl);
  // Bumping this remounts the WebView from scratch (guest session reset).
  const [resetKey, setResetKey] = useState(0);
  const pullToRefresh = !(
    noRefreshPaths ?? []
  ).some((p) => currentUrl.includes(p));

  // --- Bottom swipe bar (optional; iOS often steals this gesture) ---------
  const bottomFiredRef = useRef(false);
  const bottomBar = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          bottomFiredRef.current = false;
        },
        onPanResponderMove: (_, g) => {
          if (!bottomFiredRef.current && g.dy <= -45) {
            bottomFiredRef.current = true;
            goHome();
          }
        },
        onPanResponderRelease: (_, g) => {
          if (
            !bottomFiredRef.current &&
            Math.abs(g.dy) < 8 &&
            Math.abs(g.dx) < 8
          ) {
            goHome();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // --- Right-edge swipe ----------------------------------------------------
  const rightFiredRef = useRef(false);
  const rightEdge = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          rightFiredRef.current = false;
        },
        onPanResponderMove: (_, g) => {
          if (!rightFiredRef.current && g.dx <= -45) {
            rightFiredRef.current = true;
            goHome();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // The button shows when its toggle is on — or when every other way home
  // is off, so he can never get stuck on a site screen.
  const showButton =
    settings.navButton ||
    (!settings.navBottomSwipe &&
      !settings.navLeftEdge &&
      !settings.navRightEdge);

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
        key={script + ':' + resetKey}
        ref={webRef}
        source={{ uri: homeUrl }}
        userAgent={userAgent}
        incognito={incognito}
        injectedJavaScriptBeforeContentLoaded={script}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        pullToRefreshEnabled={pullToRefresh}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        onNavigationStateChange={(nav) => {
          setCanGoBack(nav.canGoBack);
          setCurrentUrl(nav.url);
        }}
        onShouldStartLoadWithRequest={(req) => {
          // Nothing leaves the app: app schemes (fb://, youtube://,
          // intent:, …) and app-store links are refused outright, so even
          // a get-the-app banner that slips past the filter can't kick
          // him out to the real Facebook/YouTube app.
          const url = req.url;
          if (url === 'about:blank') return true;
          if (url.startsWith('http://') || url.startsWith('https://')) {
            if (
              (blockUrlFragments ?? []).some((f) => url.includes(f))
            ) {
              return false;
            }
            return !(
              url.includes('apps.apple.com') ||
              url.includes('play.google.com')
            );
          }
          return false;
        }}
        startInLoadingState
        renderLoading={() => (
          <View
            style={[styles.loading, { backgroundColor: theme.background }]}
          >
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}
      />
      {resettable && (
        <Pressable
          accessibilityLabel="Reset guest session"
          onPress={() => setResetKey((k) => k + 1)}
          style={[
            styles.resetPill,
            {
              backgroundColor: theme.homeBtnBg,
              top: insets.top + 10,
            },
          ]}
        >
          <Text style={[styles.resetPillText, { color: theme.homeBtnGlyph }]}>
            Reset guest
          </Text>
        </Pressable>
      )}
      {settings.navBackButton && canGoBack && (
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => webRef.current?.goBack()}
          style={[
            styles.backBtn,
            {
              backgroundColor: theme.homeBtnBg,
              bottom: insets.bottom + 64,
            },
          ]}
        >
          <Text style={[styles.backBtnGlyph, { color: theme.homeBtnGlyph }]}>
            ‹
          </Text>
        </Pressable>
      )}
      {settings.navBottomSwipe && (
        <View style={styles.grabberZone} {...bottomBar.panHandlers}>
          <View
            style={[styles.grabberPill, { backgroundColor: theme.grabber }]}
          />
        </View>
      )}
      {settings.navRightEdge && (
        <View style={styles.rightEdgeZone} {...rightEdge.panHandlers} />
      )}
      {showButton && btnReady && (
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
  resetPill: {
    position: 'absolute',
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  resetPillText: { fontSize: 13, fontWeight: '600' },
  backBtn: {
    position: 'absolute',
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
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
  backBtnGlyph: {
    fontSize: 30,
    lineHeight: 32,
    marginTop: -4,
    marginRight: 2,
  },
  grabberZone: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: 180,
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 9,
    zIndex: 9,
  },
  grabberPill: {
    width: 134,
    height: 5,
    borderRadius: 3,
  },
  rightEdgeZone: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 26,
    zIndex: 9,
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
