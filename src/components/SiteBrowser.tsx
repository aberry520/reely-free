import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  Share,
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
  // Non-persistent WebView session, fully separate from the other doors:
  // its own private data store AND no shared-cookie bridge (see the
  // WebView props below), so the guest door can be logged out while the
  // Facebook door stays logged in, and neither can leak into the other.
  incognito?: boolean;
  // Show a "Reset guest" pill that remounts the WebView fresh — the known
  // recovery when Facebook's login wall stops being dismissible.
  resettable?: boolean;
  // URL fragments that must never load (e.g. Facebook's login/signup
  // pages on the guest door, where signing in is not the point).
  blockUrlFragments?: string[];
  // Which door this is — the home button's long-press switcher lists
  // the OTHER enabled doors, so it needs to know the current one.
  appId?: AppId;
  // The page's filter script can post {type:'rf-share', url} when the
  // user taps a Share control whose own flow won't work (the guest
  // Marketplace door: Facebook's share dialog wants a login). The app
  // answers with the phone's own share sheet carrying that link.
  nativeShare?: boolean;
}

export type AppId = 'facebook' | 'instagram' | 'youtube' | 'marketplace';

// The doors the home button can hot-swap between (Austin's ask,
// 2026-11-23): long-pressing the floating button lists the enabled
// ones besides the door you're in, and tapping one jumps straight
// there — no trip home first.
const APPS: {
  id: AppId;
  label: string;
  route: '/facebook' | '/instagram' | '/youtube' | '/marketplace';
  color: string;
  enabled: (s: FilterSettings) => boolean;
}[] = [
  {
    id: 'facebook',
    label: 'Facebook',
    route: '/facebook',
    color: '#1877f2',
    enabled: (s) => s.featureFacebook,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    route: '/instagram',
    color: '#d62976',
    enabled: (s) => s.featureInstagram,
  },
  {
    id: 'youtube',
    label: 'YouTube',
    route: '/youtube',
    color: '#c4302b',
    enabled: (s) => s.featureYouTube,
  },
  {
    id: 'marketplace',
    label: 'Marketplace — no account',
    route: '/marketplace',
    color: '#0f766e',
    enabled: (s) => s.featureGuestMarketplace,
  },
];

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
// - the translucent floating control: draggable anywhere, snaps to the
//   nearest side, remembers its spot across all doors. A tap goes home.
//   A long-press fans out the combined control (modeled on the Windows
//   floating hub in Austin's reference video, 2026-11-23): satellite
//   buttons appear beside it — Back (always there, greyed out when
//   there's nowhere to go back to), one per other enabled door, and
//   Settings — so home, back and hot-swap all live in this one
//   control; the old separate back button and switcher panel are gone.
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
  appId,
  nativeShare,
}: SiteBrowserProps) {
  const { settings, loaded } = useSettings();
  // Getting Home has no feature master (Austin's hierarchy,
  // 2026-11-23) — each way home is governed by its own toggle.
  const navCfg = {
    button: settings.navButton,
    bottomSwipe: settings.navBottomSwipe,
    leftEdge: settings.navLeftEdge,
    rightEdge: settings.navRightEdge,
    backButton: settings.navBackButton,
  };
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
    navCfg.button || (!navCfg.bottomSwipe && !navCfg.leftEdge && !navCfg.rightEdge);

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

  // Long-press on the floating control fans out its satellites. The
  // press timer only survives a still finger: any real drag cancels
  // it, and a fired long-press suppresses the tap-to-go-home on
  // release. hubPos snapshots the button's spot when the fan opens,
  // so the satellites anchor to where the button actually is.
  const [expanded, setExpanded] = useState(false);
  const [hubPos, setHubPos] = useState({ x: 0, y: 0 });
  // Mirror of `expanded` for the (memoized) pan handlers, plus a flag
  // for "this press started on an open fan" — that tap only collapses
  // the fan, it must not also go home.
  const expandedRef = useRef(false);
  const collapseOnlyRef = useRef(false);
  const openFan = () => {
    expandedRef.current = true;
    setExpanded(true);
  };
  const closeFan = () => {
    expandedRef.current = false;
    setExpanded(false);
  };
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const btnPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...posRef.current };
          longPressedRef.current = false;
          collapseOnlyRef.current = expandedRef.current;
          if (expandedRef.current) closeFan();
          clearPressTimer();
          pressTimerRef.current = setTimeout(() => {
            longPressedRef.current = true;
            setHubPos({ ...posRef.current });
            openFan();
          }, 450);
        },
        onPanResponderMove: (_, g) => {
          if (Math.hypot(g.dx, g.dy) >= 8) clearPressTimer();
          pan.setValue({
            x: dragStartRef.current.x + g.dx,
            y: dragStartRef.current.y + g.dy,
          });
        },
        onPanResponderRelease: (_, g) => {
          clearPressTimer();
          if (longPressedRef.current) {
            longPressedRef.current = false;
            return;
          }
          if (collapseOnlyRef.current) {
            collapseOnlyRef.current = false;
            return;
          }
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
        onPanResponderTerminate: () => {
          clearPressTimer();
          longPressedRef.current = false;
          collapseOnlyRef.current = false;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // --- Combined floating control: the satellite fan ---------------------
  // Back (only when there's somewhere to go back to and its toggle is
  // on), then one satellite per other enabled door. The fan opens
  // toward the middle of the screen from wherever the hub sits, as a
  // vertical stack centered on the hub, clamped to the screen.
  const SAT = 46;
  const SAT_GAP = 10;
  const satellites: {
    key: string;
    label: string;
    bg: string;
    icon: React.ReactNode;
    dimmed?: boolean;
    action: () => void;
  }[] = [];
  if (navCfg.backButton) {
    // Back is ALWAYS in the fan when its toggle is on (Austin's ask,
    // 2026-11-23) — greyed out and inert when there's nowhere to go
    // back to right now, so the fan's layout never changes under him.
    satellites.push({
      key: 'back',
      label: canGoBack ? 'Go back' : 'Go back (nothing to go back to)',
      bg: theme.homeBtnBg,
      dimmed: !canGoBack,
      icon: (
        <MaterialIcons
          name="arrow-back"
          size={24}
          color={theme.homeBtnGlyph}
        />
      ),
      action: () => {
        if (canGoBack) webRef.current?.goBack();
      },
    });
  }
  for (const a of APPS) {
    if (a.id === appId || !a.enabled(settings)) continue;
    const icon =
      a.id === 'facebook' ? (
        <FontAwesome5 name="facebook-f" size={20} color="#fff" />
      ) : a.id === 'instagram' ? (
        <FontAwesome5 name="instagram" size={20} color="#fff" />
      ) : a.id === 'youtube' ? (
        <FontAwesome5 name="youtube" size={20} color="#fff" />
      ) : (
        <MaterialIcons name="storefront" size={22} color="#fff" />
      );
    satellites.push({
      key: a.id,
      label: a.label,
      bg: a.color,
      icon,
      // Replace, not push: swapping shouldn't stack the doors on top
      // of each other in the back history.
      action: () => router.replace(a.route),
    });
  }
  satellites.push({
    key: 'settings',
    label: 'Settings',
    bg: theme.homeBtnBg,
    icon: (
      <MaterialIcons name="settings" size={24} color={theme.homeBtnGlyph} />
    ),
    action: () => router.navigate('/settings'),
  });
  const fanTowardCenter = hubPos.x + BTN / 2 < win.width / 2;
  const satX = fanTowardCenter ? hubPos.x + BTN + 12 : hubPos.x - SAT - 12;
  const satTotal =
    satellites.length * SAT +
    Math.max(0, satellites.length - 1) * SAT_GAP;
  const satStartY = Math.min(
    Math.max(hubPos.y + BTN / 2 - satTotal / 2, insets.top + 8),
    Math.max(insets.top + 8, win.height - satTotal - 8),
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
        geolocationEnabled
        thirdPartyCookiesEnabled={!incognito}
        // Shared cookies are the bridge between doors: the Facebook door
        // writes its login into the shared cookie storage and every
        // shared-cookies WebView reads it back at startup — including an
        // incognito one, whose private data store still gets the shared
        // cookies copied in (that's how the guest Marketplace door first
        // showed him logged in). An incognito door must never share, in
        // either direction, or the two sessions are not separate at all.
        sharedCookiesEnabled={!incognito}
        cacheEnabled={!incognito}
        pullToRefreshEnabled={pullToRefresh}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        onNavigationStateChange={(nav) => {
          setCanGoBack(nav.canGoBack);
          setCurrentUrl(nav.url);
        }}
        onMessage={
          nativeShare
            ? (event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data) as {
                    type?: string;
                    url?: string;
                  };
                  if (
                    data.type === 'rf-share' &&
                    typeof data.url === 'string' &&
                    data.url.startsWith('https://')
                  ) {
                    Share.share({ url: data.url }).catch(() => {});
                  }
                } catch {
                  // Not one of ours — ignore.
                }
              }
            : undefined
        }
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
      {navCfg.bottomSwipe && (
        <View style={styles.grabberZone} {...bottomBar.panHandlers}>
          <View
            style={[styles.grabberPill, { backgroundColor: theme.grabber }]}
          />
        </View>
      )}
      {navCfg.rightEdge && (
        <View style={styles.rightEdgeZone} {...rightEdge.panHandlers} />
      )}
      {showButton && btnReady && (
        <Animated.View
          {...btnPan.panHandlers}
          accessibilityLabel="Go home — long-press to switch apps"
          style={[
            styles.homeBtn,
            {
              backgroundColor: theme.homeBtnBg,
              transform: pan.getTranslateTransform(),
            },
          ]}
        >
          <MaterialIcons
            name="home"
            size={28}
            color={theme.homeBtnGlyph}
          />
        </Animated.View>
      )}
      {expanded && showButton && satellites.length > 0 && (
        <View style={styles.fanOverlay}>
          <Pressable style={styles.fanBackdrop} onPress={closeFan} />
          {satellites.map((s, i) => (
            <Pressable
              key={s.key}
              accessibilityLabel={s.label}
              onPress={() => {
                closeFan();
                s.action();
              }}
              style={[
                styles.satellite,
                {
                  backgroundColor: s.bg,
                  left: satX,
                  top: satStartY + i * (SAT + SAT_GAP),
                  opacity: s.dimmed ? 0.35 : 1,
                },
              ]}
            >
              {s.icon}
            </Pressable>
          ))}
        </View>
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
  fanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  fanBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  satellite: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
});
