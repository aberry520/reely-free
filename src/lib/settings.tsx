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
  // Ways to get back home from a site screen (Austin's picks, 2026-11-22)
  navButton: boolean;
  navBottomSwipe: boolean;
  navLeftEdge: boolean;
  navRightEdge: boolean;
  navBackButton: boolean;
}

export const DEFAULT_SETTINGS: FilterSettings = {
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
