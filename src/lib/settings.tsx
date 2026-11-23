import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// Reely Free filter settings. Defaults follow Austin's picks (2026-11-22):
// Messenger stays separate, YouTube lands on Subscriptions, Facebook hides
// ALL suggested content.
export interface FilterSettings {
  // Feature master toggles (Austin's ask, 2026-11-23): one switch per
  // feature at the top of its Settings section. Turning a feature off
  // hides its sub-toggles in Settings, removes its door from the home
  // screen (the guest search launcher goes with the Marketplace card),
  // AND switches the feature itself off — the filter script for that
  // door goes inert, and the Getting home aids all stand down (the
  // anti-stuck floating button still stays, per the long-standing
  // rule). Sub-toggle values are kept, so turning the feature back on
  // restores the previous setup.
  featureYouTube: boolean;
  featureFacebook: boolean;
  featureGuestMarketplace: boolean;
  featureGettingHome: boolean;
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
  // Guest Marketplace (experimental desktop door). No location settings
  // on purpose (his decision, 2026-11-23): typed city/radius fields and
  // then a "use my location" toggle both failed to move Facebook, which
  // detects location itself (it found Iva, SC from his IP) and does a
  // good job of it — anyone who wants somewhere else can change it
  // inside Marketplace's own location dialog.
  mpGuestDismissLogin: boolean;
  mpGuestBlockLoginBar: boolean;
  // Ways to get back home from a site screen (Austin's picks, 2026-11-22)
  navButton: boolean;
  navBottomSwipe: boolean;
  navLeftEdge: boolean;
  navRightEdge: boolean;
  navBackButton: boolean;
}

export const DEFAULT_SETTINGS: FilterSettings = {
  featureYouTube: true,
  featureFacebook: true,
  featureGuestMarketplace: true,
  featureGettingHome: true,
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
  mpGuestDismissLogin: true,
  mpGuestBlockLoginBar: true,
  // Bottom swipe defaults OFF: iOS grabs the whole bottom edge for its own
  // home gesture, so it was inconsistent in his on-device test. The other
  // three default on.
  navButton: true,
  navBottomSwipe: false,
  navLeftEdge: true,
  navRightEdge: true,
  navBackButton: true,
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
