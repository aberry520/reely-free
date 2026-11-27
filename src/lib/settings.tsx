import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { pushDoorsWidgetSnapshot } from './widgets';

// Reely Free filter settings. Defaults follow Austin's picks (2026-11-22):
// Messenger stays separate, YouTube lands on Subscriptions, Facebook hides
// ALL suggested content.
export interface FilterSettings {
  // Feature master toggles (Austin's ask, 2026-11-23): one switch per
  // supported app at the top of its Settings block, under the
  // "Supported apps" group header. Turning a feature off hides its
  // sub-toggles in Settings, removes its door from the home screen,
  // AND switches the feature itself off (its filter script goes
  // inert). Sub-toggle values are kept, so turning the feature back
  // on restores the previous setup. Getting Home has NO master — it
  // is a plain group header in the hierarchy he specified; its ways
  // home are governed by their own toggles below.
  featureYouTube: boolean;
  featureFacebook: boolean;
  featureInstagram: boolean;
  featureGuestMarketplace: boolean;
  featureMarketplaceAccount: boolean;
  // YouTube
  ytBlockShorts: boolean;
  ytLandOnSubs: boolean;
  ytHideUpNext: boolean;
  ytBlockAppPromo: boolean;
  ytSwipeDownBack: boolean;
  // Facebook
  fbBlockReels: boolean;
  fbHideSuggested: boolean;
  fbHideSponsored: boolean;
  fbBlockAppPromo: boolean;
  fbStickyHeader: boolean;
  igBlockReels: boolean;
  igHideExplore: boolean;
  // Despite the key name (kept from v1 so his saved value carries
  // over), since v3 this BLOCKS OPENING suggested posts — the feed
  // itself is never hidden any more (see filters/instagram.ts).
  igHideSuggested: boolean;
  igBlockAppPromo: boolean;
  // Daily usage limits (Austin's ask, 2026-11-23): per door, a daily
  // limit in minutes (0 = no limit) and what happens at the cap —
  // lock = true covers the door for the rest of the day, lock =
  // false just shows a warning banner. Time is counted by
  // SiteBrowser (focused + foreground only) into src/lib/usage.ts.
  // Marketplace inside Facebook counts as Facebook time (same door);
  // the guest door has its own mp* pair.
  fbDailyLimitMin: number;
  fbLimitLock: boolean;
  igDailyLimitMin: number;
  igLimitLock: boolean;
  ytDailyLimitMin: number;
  ytLimitLock: boolean;
  mpDailyLimitMin: number;
  mpLimitLock: boolean;
  mpaDailyLimitMin: number;
  mpaLimitLock: boolean;
  // Marketplace WITH his account (Austin's ask, 2026-11-23): a door
  // that signs into Facebook but stays in Marketplace — the rest of
  // Facebook is ignored. Stay = taps that would leave Marketplace
  // do nothing and stray landings bounce back; messages can stay
  // reachable for talking to buyers and sellers.
  mpaStayInMarketplace: boolean;
  mpaAllowMessages: boolean;
  mpaBlockAppPromo: boolean;
  mpaBrandHeader: boolean;
  // Guest Marketplace (experimental desktop door). No location settings
  // on purpose (his decision, 2026-11-23): typed city/radius fields and
  // then a "use my location" toggle both failed to move Facebook, which
  // detects location itself (it found Iva, SC from his IP) and does a
  // good job of it — anyone who wants somewhere else can change it
  // inside Marketplace's own location dialog.
  mpGuestDismissLogin: boolean;
  mpGuestBlockLoginBar: boolean;
  mpGuestNativeShare: boolean;
  // Ways to get back home from a site screen (Austin's picks, 2026-11-22)
  navButton: boolean;
  navBottomSwipe: boolean;
  navLeftEdge: boolean;
  navRightEdge: boolean;
  navBackButton: boolean;
  // Branded header per door (Austin's ask, 2026-11-23): the Reely
  // Free mark worked into each door's own header, without blocking
  // anything that header does. Marketplace — with account already
  // had mpaBrandHeader (a full cover over the disposable nav).
  fbBrandHeader: boolean;
  igBrandHeader: boolean;
  ytBrandHeader: boolean;
  mpGuestBrandHeader: boolean;
  // Bedtime per door (Austin's ask, 2026-11-23): the hour after
  // which the door locks until morning. 0 = off, 21 = 9 PM,
  // 22 = 10 PM, 23 = 11 PM, 24 = midnight. The lock runs from the
  // bedtime hour until 5 AM.
  fbBedtimeHour: number;
  igBedtimeHour: number;
  ytBedtimeHour: number;
  mpBedtimeHour: number;
  mpaBedtimeHour: number;
  // What a double-tap on the floating button does (Austin's ask,
  // 2026-11-23): 'none' = no double-tap action (a double tap just
  // opens then closes the fan, as before). 'lastDoor' = the door
  // you were in before this one.
  hubDoubleTap: 'none' | 'back' | 'home' | 'settings' | 'lastDoor';
  // Diagnostic panels (Austin's ask, 2026-11-24): when on, every
  // door shows a small panel at the bottom reporting what that
  // door's filter sees — the page, the videos, what got blocked
  // or covered. Turn it on when testing a new feature, off when
  // you're done. Off by default.
  diagnosticsEnabled: boolean;
}

export const DEFAULT_SETTINGS: FilterSettings = {
  featureYouTube: true,
  featureFacebook: true,
  featureInstagram: true,
  featureGuestMarketplace: true,
  featureMarketplaceAccount: true,
  ytBlockShorts: true,
  ytLandOnSubs: true,
  ytHideUpNext: true,
  ytBlockAppPromo: true,
  ytSwipeDownBack: true,
  fbBlockReels: true,
  fbHideSuggested: true,
  fbHideSponsored: true,
  fbBlockAppPromo: true,
  fbStickyHeader: true,
  igBlockReels: true,
  igHideExplore: true,
  igHideSuggested: true,
  igBlockAppPromo: true,
  fbDailyLimitMin: 0,
  fbLimitLock: true,
  igDailyLimitMin: 0,
  igLimitLock: true,
  ytDailyLimitMin: 0,
  ytLimitLock: true,
  mpDailyLimitMin: 0,
  mpLimitLock: true,
  mpaDailyLimitMin: 0,
  mpaLimitLock: true,
  mpaStayInMarketplace: true,
  mpaAllowMessages: true,
  mpaBlockAppPromo: true,
  mpaBrandHeader: true,
  mpGuestDismissLogin: true,
  mpGuestBlockLoginBar: true,
  mpGuestNativeShare: true,
  // Bottom swipe defaults OFF: iOS grabs the whole bottom edge for its own
  // home gesture, so it was inconsistent in his on-device test. The other
  // three default on.
  navButton: true,
  navBottomSwipe: false,
  navLeftEdge: true,
  navRightEdge: true,
  navBackButton: true,
  hubDoubleTap: 'none',
  fbBrandHeader: true,
  igBrandHeader: true,
  ytBrandHeader: true,
  mpGuestBrandHeader: true,
  fbBedtimeHour: 0,
  igBedtimeHour: 0,
  ytBedtimeHour: 0,
  mpBedtimeHour: 0,
  mpaBedtimeHour: 0,
  diagnosticsEnabled: false,
};

const STORAGE_KEY = 'reelyfree-settings-v1';

interface SettingsContextValue {
  settings: FilterSettings;
  loaded: boolean;
  update: (patch: Partial<FilterSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  update: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<FilterSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<FilterSettings>;
            setSettings({ ...DEFAULT_SETTINGS, ...parsed });
          } catch {
            // Corrupt saved settings: fall back to defaults.
          }
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the home screen widget in sync (Austin's widget ask,
  // 2026-11-26): push the enabled-doors list whenever settings
  // load or change, so the widget only shows the doors that are
  // on. No-ops in Expo Go / web / builds without the widget.
  useEffect(() => {
    if (loaded) pushDoorsWidgetSnapshot(settings);
  }, [loaded, settings]);

  const update = useCallback((patch: Partial<FilterSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, loaded, update }),
    [settings, loaded, update],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
