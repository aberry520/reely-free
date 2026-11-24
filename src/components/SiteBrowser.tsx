import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import {
  endFocus,
  formatBedtime,
  formatClock,
  formatFocusLeft,
  getFocusUntil,
  isBedtimeNow,
  isManualLocked,
  lockManually,
  unlockManually,
} from '../lib/locks';
import type { FilterSettings } from '../lib/settings';
import { useSettings } from '../lib/settings';
import { useTheme } from '../lib/theme';
import {
  addUsageSeconds,
  formatLimit,
  formatMinutes,
  getTodaySeconds,
} from '../lib/usage';

// Haptics for the floating control (Austin's ask, 2026-11-23):
// a light tap when the fan opens or a satellite is pressed, a
// medium tap when a double-tap action fires, a light tap when a
// drag snaps the button to a side. Wrapped so a device without
// haptics just does nothing instead of crashing.
function haptic(kind: 'light' | 'medium' | 'selection') {
  try {
    if (kind === 'selection') {
      Haptics.selectionAsync().catch(() => {});
    } else {
      Haptics.impactAsync(
        kind === 'medium'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      ).catch(() => {});
    }
  } catch {
    // Haptics unavailable — ignore.
  }
}

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
  // Which door this is — the floating control's fan lists the OTHER
  // enabled doors, so it needs to know the current one.
  appId?: AppId;
  // The page's filter script can post {type:'rf-share', url} when the
  // user taps a Share control whose own flow won't work (the guest
  // Marketplace door: Facebook's share dialog wants a login). The app
  // answers with the phone's own share sheet carrying that link.
  nativeShare?: boolean;
}

export type AppId =
  | 'facebook'
  | 'instagram'
  | 'youtube'
  | 'marketplace'
  | 'marketplaceAccount';

// The doors the floating control can hot-swap between (Austin's
// ask, 2026-11-23): the fan lists the enabled ones besides the
// door you're in, and tapping one jumps straight there — no trip
// home first.
const APPS: {
  id: AppId;
  label: string;
  route:
    | '/facebook'
    | '/instagram'
    | '/youtube'
    | '/marketplace'
    | '/marketplace-account';
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
  {
    id: 'marketplaceAccount',
    label: 'Marketplace — with account',
    route: '/marketplace-account',
    color: '#1e40af',
    enabled: (s) => s.featureMarketplaceAccount,
  },
];

const BTN = 50;
const BTN_POS_KEY = 'reelyfree-homebtn-v1';
// Bedtime (Austin's ask, 2026-11-23): which settings key governs
// each door's bedtime hour (0 = off, 21 = 9 PM, 22 = 10 PM,
// 23 = 11 PM, 24 = midnight). The door locks from that hour
// until 5 AM.
const BEDTIME_CFG: Partial<Record<AppId, keyof FilterSettings>> = {
  facebook: 'fbBedtimeHour',
  instagram: 'igBedtimeHour',
  youtube: 'ytBedtimeHour',
  marketplace: 'mpBedtimeHour',
  marketplaceAccount: 'mpaBedtimeHour',
};
// The door visited before this one (Austin's "last door"
// double-tap, 2026-11-23): the previous door's route, kept in
// storage so it survives app restarts.
const LAST_DOOR_KEY = 'reelyfree-last-door-v1';

// Daily usage limits (Austin's ask, 2026-11-23): which settings keys
// govern each door's limit — minutes per day (0 = no limit) and
// whether hitting the cap locks the door or just warns.
const LIMIT_CFG: Record<
  AppId,
  { min: keyof FilterSettings; lock: keyof FilterSettings; label: string }
> = {
  facebook: {
    min: 'fbDailyLimitMin',
    lock: 'fbLimitLock',
    label: 'Facebook',
  },
  instagram: {
    min: 'igDailyLimitMin',
    lock: 'igLimitLock',
    label: 'Instagram',
  },
  youtube: { min: 'ytDailyLimitMin', lock: 'ytLimitLock', label: 'YouTube' },
  marketplace: {
    min: 'mpDailyLimitMin',
    lock: 'mpLimitLock',
    label: 'Marketplace',
  },
  marketplaceAccount: {
    min: 'mpaDailyLimitMin',
    lock: 'mpaLimitLock',
    label: 'Marketplace',
  },
};

// One filtered site, full-screen: no header, no toolbar. The platform's real
// mobile site with the filter layer injected before content loads. Login
// cookies persist in the WebView, so signing in is a one-time thing per site.
//
// Getting home — each way is individually toggleable in Settings:
// - left-edge swipe: the stack's built-in iOS back gesture (see _layout)
// - right-edge swipe: a thin zone on the right edge, swipe left to go home
// - bottom swipe: a bar at the bottom center (iOS often steals this one)
// - the translucent floating control: draggable anywhere, snaps to the
//   nearest side, remembers its spot across all doors. The button is
//   the Reely Free icon itself; a tap fans out the combined control
//   (modeled on the Windows floating hub in Austin's reference video,
//   2026-11-23): satellite buttons appear beside it — Home, Back
//   (always there, greyed out when there's nowhere to go back to),
//   one per other enabled door, and Settings — so home, back and
//   hot-swap all live in this one control. (A tap replaced the
//   original long-press, and Home moved into the fan, at Austin's
//   ask, 2026-11-23.)
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

  // --- Daily usage tracking + limits ---------------------------------
  // Time counts only while this door is the focused screen AND the
  // app is in the foreground — a door sitting under Home in the
  // stack, or the app backgrounded, earns nothing. Seconds are
  // banked into the usage store every 5s and on blur. At the cap:
  // lock covers the door for the rest of the day; lock off shows a
  // dismissible warning banner instead (from 5 minutes out).
  const limitCfg = appId ? LIMIT_CFG[appId] : null;
  const limitMin = limitCfg ? (settings[limitCfg.min] as number) : 0;
  const limitLock = limitCfg
    ? (settings[limitCfg.lock] as boolean)
    : true;
  const [usedSec, setUsedSec] = useState(0);
  const [warnDismissed, setWarnDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!appId) return undefined;
      let cancelled = false;
      setWarnDismissed(false);
      getTodaySeconds(appId)
        .then((s) => {
          if (!cancelled) setUsedSec(s);
        })
        .catch(() => {});
      isManualLocked(appId)
        .then((v) => {
          if (!cancelled) setManualLocked(v);
        })
        .catch(() => {});
      getFocusUntil()
        .then((u) => {
          if (!cancelled) setFocusUntil(u);
        })
        .catch(() => {});
      let pending = 0;
      let last = Date.now();
      let sinceCheck = 0;
      const iv = setInterval(() => {
        const now = Date.now();
        if (AppState.currentState === 'active') {
          pending += (now - last) / 1000;
        }
        last = now;
        if (pending >= 5) {
          const whole = Math.floor(pending);
          pending -= whole;
          addUsageSeconds(appId, whole);
          setUsedSec((s) => s + whole);
        }
        // Every 30s: refresh the focus countdown and clear a
        // focus timer that has run out while the door was open.
        sinceCheck += 1;
        if (sinceCheck >= 30) {
          sinceCheck = 0;
          setNowMs(now);
          getFocusUntil()
            .then((u) => {
              if (!cancelled) setFocusUntil(u);
            })
            .catch(() => {});
        }
      }, 1000);
      return () => {
        cancelled = true;
        clearInterval(iv);
        if (pending >= 1) addUsageSeconds(appId, Math.floor(pending));
      };
    }, [appId]),
  );

  const limitSec = limitMin * 60;
  const overLimit = limitMin > 0 && usedSec >= limitSec;
  const remainingSec = limitSec - usedSec;
  const showLock = overLimit && limitLock;

  // Locks beyond the daily limit (Austin's ask, 2026-11-23): a
  // manual lock from the fan, a per-door bedtime, and the global
  // focus timer. One cover serves all four reasons; focus wins,
  // then manual, then bedtime, then the limit.
  const bedtimeKey = appId ? BEDTIME_CFG[appId] : null;
  const bedtimeHour = bedtimeKey ? (settings[bedtimeKey] as number) : 0;
  const isBedtime = isBedtimeNow(bedtimeHour);
  const [manualLocked, setManualLocked] = useState(false);
  const [focusUntil, setFocusUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const focusActive = focusUntil !== null && focusUntil > nowMs;
  const coverReason: 'limit' | 'manual' | 'bedtime' | 'focus' | null =
    focusActive
      ? 'focus'
      : manualLocked
        ? 'manual'
        : isBedtime
          ? 'bedtime'
          : showLock
            ? 'limit'
            : null;
  const showWarn =
    limitMin > 0 &&
    !limitLock &&
    !warnDismissed &&
    (overLimit || remainingSec <= 300);

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

  // A tap on the floating control fans out its satellites (it used
  // to take a long-press; Austin asked for tap, 2026-11-23). A
  // double-tap runs the action picked in Settings (none by
  // default); see the double-tap block just above the pan handler.
  // hubPos snapshots the button's spot when the fan opens, so the
  // satellites anchor to where the button actually is.
  const [expanded, setExpanded] = useState(false);
  const [hubPos, setHubPos] = useState({ x: 0, y: 0 });
  // Mirror of `expanded` for the (memoized) pan handlers, plus a flag
  // for "this press started on an open fan" — that tap only collapses
  // the fan, it must not also go home.
  const expandedRef = useRef(false);
  const collapseOnlyRef = useRef(false);
  const openFan = () => {
    haptic('selection');
    expandedRef.current = true;
    setExpanded(true);
  };
  const closeFan = () => {
    haptic('selection');
    expandedRef.current = false;
    setExpanded(false);
  };
  // --- Double-tap action on the floating button ---------------------
  // Austin's ask, 2026-11-23: two quick taps run a chosen action
  // (Settings > Getting Home > Double-tap floating button). The
  // pan handlers are memoized once, so everything they read lives
  // in refs that stay current.
  const lastDoorRef = useRef<string | null>(null);
  const hubDoubleTapRef = useRef(settings.hubDoubleTap);
  useEffect(() => {
    hubDoubleTapRef.current = settings.hubDoubleTap;
  }, [settings.hubDoubleTap]);
  const canGoBackRef = useRef(false);
  useEffect(() => {
    canGoBackRef.current = canGoBack;
  }, [canGoBack]);
  const doubleTapActionRef = useRef(() => {});
  doubleTapActionRef.current = () => {
    switch (hubDoubleTapRef.current) {
      case 'back':
        if (canGoBackRef.current) {
          haptic('medium');
          webRef.current?.goBack();
        }
        break;
      case 'home':
        haptic('medium');
        goHome();
        break;
      case 'settings':
        haptic('medium');
        router.navigate('/settings');
        break;
      case 'lastDoor':
        if (lastDoorRef.current) {
          haptic('medium');
          router.replace(lastDoorRef.current);
        }
        break;
      default:
        break;
    }
  };
  // Remember this door as the last one visited, and keep the
  // previous door's route for the double-tap jump.
  useEffect(() => {
    const myRoute = APPS.find((a) => a.id === appId)?.route ?? null;
    AsyncStorage.getItem(LAST_DOOR_KEY)
      .then((prev) => {
        if (prev && prev !== myRoute) lastDoorRef.current = prev;
        if (myRoute) return AsyncStorage.setItem(LAST_DOOR_KEY, myRoute);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A pending single tap waits 300ms to see whether a second tap
  // follows; those timers are armed in the pan release handler.
  const lastTapRef = useRef(0);
  const pendingTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pendingTapRef.current) clearTimeout(pendingTapRef.current);
    },
    [],
  );
  const btnPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...posRef.current };
          // A press that follows a tap cancels that tap's wait
          // for a second tap — it belongs to the new gesture.
          if (pendingTapRef.current) {
            clearTimeout(pendingTapRef.current);
            pendingTapRef.current = null;
          }
          collapseOnlyRef.current = expandedRef.current;
          if (expandedRef.current) {
            closeFan();
            // Closing the fan isn't the first tap of a double.
            lastTapRef.current = 0;
          }
        },
        onPanResponderMove: (_, g) => {
          pan.setValue({
            x: dragStartRef.current.x + g.dx,
            y: dragStartRef.current.y + g.dy,
          });
        },
        onPanResponderRelease: (_, g) => {
          if (collapseOnlyRef.current) {
            collapseOnlyRef.current = false;
            return;
          }
          if (Math.hypot(g.dx, g.dy) < 8) {
            // A tap. (A tap that started on an open fan was
            // already handled at grant time — it only collapses,
            // via collapseOnlyRef above.)
            if (hubDoubleTapRef.current === 'none') {
              // No double-tap action configured: the fan opens
              // at once, no waiting.
              lastTapRef.current = 0;
              setHubPos({ ...posRef.current });
              openFan();
              return;
            }
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
              // Second tap inside the window: run the chosen
              // action instead of opening the fan.
              lastTapRef.current = 0;
              if (pendingTapRef.current) {
                clearTimeout(pendingTapRef.current);
                pendingTapRef.current = null;
              }
              doubleTapActionRef.current();
              return;
            }
            // First tap: wait a beat for a second one before
            // opening the fan.
            lastTapRef.current = now;
            pendingTapRef.current = setTimeout(() => {
              pendingTapRef.current = null;
              setHubPos({ ...posRef.current });
              openFan();
            }, 300);
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
          haptic('light');
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
          collapseOnlyRef.current = false;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // --- Combined floating control: the satellite fan ---------------------
  // Home first (it used to be the hub's own tap action; Austin moved
  // it into the fan, 2026-11-23), then Back, then one satellite per
  // other enabled door, then Settings. The fan opens toward the
  // middle of the screen from wherever the hub sits, as a vertical
  // stack centered on the hub, clamped to the screen.
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
  satellites.push({
    key: 'home',
    label: 'Home',
    bg: theme.homeBtnBg,
    icon: (
      <MaterialIcons name="home" size={24} color={theme.homeBtnGlyph} />
    ),
    action: goHome,
  });
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
  // Lock until tomorrow (Austin's ask, 2026-11-23): one tap in the
  // fan locks this door for the rest of the day. The cover it
  // shows has an Unlock button, so a stray tap isn't a trap.
  if (appId) {
    satellites.push({
      key: 'lock',
      label: 'Lock until tomorrow',
      bg: theme.homeBtnBg,
      icon: (
        <MaterialIcons name="lock" size={24} color={theme.homeBtnGlyph} />
      ),
      action: () => {
        lockManually(appId)
          .then(() => setManualLocked(true))
          .catch(() => {});
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
        // PiP is on by default in react-native-webview, but set it
        // explicitly so the YouTube PiP button (2026-11-24) can
        // never be silently off.
        allowsPictureInPictureMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        onNavigationStateChange={(nav) => {
          setCanGoBack(nav.canGoBack);
          setCurrentUrl(nav.url);
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data) as {
              type?: string;
              url?: string;
            };
            if (
              nativeShare &&
              data.type === 'rf-share' &&
              typeof data.url === 'string' &&
              data.url.startsWith('https://')
            ) {
              Share.share({ url: data.url }).catch(() => {});
            }
          } catch {
            // Not one of ours — ignore.
          }
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
      {showWarn && limitCfg && (
        <View
          style={[
            styles.warnBanner,
            { backgroundColor: theme.homeBtnBg, top: insets.top + 8 },
          ]}
        >
          <Text style={[styles.warnText, { color: theme.homeBtnGlyph }]}>
            {overLimit
              ? `Over your ${limitCfg.label} limit — ${formatMinutes(usedSec)} today`
              : `${Math.max(1, Math.ceil(remainingSec / 60))} min of ${limitCfg.label} left today`}
          </Text>
          <Pressable
            accessibilityLabel="Dismiss usage warning"
            onPress={() => setWarnDismissed(true)}
            hitSlop={8}
          >
            <MaterialIcons name="close" size={16} color={theme.homeBtnGlyph} />
          </Pressable>
        </View>
      )}
      {coverReason && limitCfg && (
        <View
          style={[
            styles.lockOverlay,
            { backgroundColor: theme.background },
          ]}
        >
          <Image
            source={require('../../assets/logo-full.png')}
            style={styles.lockLogo}
          />
          <Text style={[styles.lockTitle, { color: theme.text }]}>
            {coverReason === 'focus' && focusUntil
              ? `Focus until ${formatClock(focusUntil)}`
              : coverReason === 'manual'
                ? `${limitCfg.label} locked until tomorrow`
                : coverReason === 'bedtime'
                  ? `Past bedtime for ${limitCfg.label}`
                  : `${limitCfg.label} time's up for today`}
          </Text>
          <Text style={[styles.lockDetail, { color: theme.muted }]}>
            {coverReason === 'focus' && focusUntil
              ? `Every door is paused — ${formatFocusLeft(focusUntil)}.`
              : coverReason === 'manual'
                ? `You locked ${limitCfg.label} from the fan. It unlocks tomorrow — or unlock it now below.`
                : coverReason === 'bedtime'
                  ? `You set a ${formatBedtime(bedtimeHour)} bedtime for ${limitCfg.label}. It opens again in the morning.`
                  : `You've used ${formatMinutes(usedSec)} of your ${formatLimit(limitMin)} daily limit. It resets tomorrow.`}
          </Text>
          <Pressable
            style={[styles.lockButton, { backgroundColor: theme.accent }]}
            onPress={goHome}
          >
            <Text style={styles.lockButtonText}>Go home</Text>
          </Pressable>
          {coverReason === 'manual' && appId && (
            <Pressable
              style={[
                styles.lockButtonSecondary,
                { borderColor: theme.border },
              ]}
              onPress={() => {
                unlockManually(appId)
                  .then(() => setManualLocked(false))
                  .catch(() => {});
              }}
            >
              <Text
                style={[styles.lockButtonSecondaryText, { color: theme.text }]}
              >
                Unlock for today
              </Text>
            </Pressable>
          )}
          {coverReason === 'focus' && (
            <Pressable
              style={[
                styles.lockButtonSecondary,
                { borderColor: theme.border },
              ]}
              onPress={() => {
                endFocus()
                  .then(() => setFocusUntil(null))
                  .catch(() => {});
              }}
            >
              <Text
                style={[styles.lockButtonSecondaryText, { color: theme.text }]}
              >
                End focus
              </Text>
            </Pressable>
          )}
        </View>
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
          accessibilityLabel="Reely Free menu — tap to open, drag to move"
          style={[
            styles.homeBtn,
            {
              transform: pan.getTranslateTransform(),
            },
          ]}
        >
          <Image
            source={require('../../assets/logo-mark.png')}
            style={styles.homeBtnIcon}
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
                haptic('light');
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
  homeBtnIcon: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
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
  warnBanner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '92%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 12,
  },
  warnText: { fontSize: 13, fontWeight: '600' },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 15,
  },
  lockLogo: { width: 120, height: 120, borderRadius: 26 },
  lockTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 20,
  },
  lockDetail: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  lockButton: {
    marginTop: 24,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 24,
  },
  lockButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  lockButtonSecondary: {
    marginTop: 12,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  lockButtonSecondaryText: { fontSize: 15, fontWeight: '600' },
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
