import AsyncStorage from '@react-native-async-storage/async-storage';

// Daily usage time per door (Austin's ask, 2026-11-23). SiteBrowser
// adds focused, foreground seconds while a door is open; the home
// cards and Settings read the totals back. Everything stays on the
// phone, keyed by local date, and only the last 14 days are kept.
// This can only ever count time inside Reely Free's own doors —
// iOS gives no app a way to watch or limit other apps.

export type UsageAppId =
  | 'facebook'
  | 'instagram'
  | 'youtube'
  | 'marketplace'
  | 'marketplaceAccount';

type UsageData = Record<string, Partial<Record<UsageAppId, number>>>;

const STORAGE_KEY = 'reelyfree-usage-v1';
const KEEP_DAYS = 14;

let cache: UsageData | null = null;
let loadPromise: Promise<UsageData> | null = null;

export function todayKey(d = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function loadUsage(): Promise<UsageData> {
  if (cache) return Promise.resolve(cache);
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        try {
          cache = raw ? (JSON.parse(raw) as UsageData) : {};
        } catch {
          cache = {};
        }
        return cache;
      })
      .catch(() => {
        cache = {};
        return cache;
      });
  }
  return loadPromise;
}

export async function getTodaySeconds(appId: UsageAppId): Promise<number> {
  const data = await loadUsage();
  return data[todayKey()]?.[appId] ?? 0;
}

// This week's seconds in a door: today plus the six days before
// it (the store keeps 14 days, so a full week is always there).
export async function getWeekSeconds(appId: UsageAppId): Promise<number> {
  const data = await loadUsage();
  let total = 0;
  for (let back = 0; back < 7; back++) {
    const d = new Date(Date.now() - back * 24 * 60 * 60 * 1000);
    total += data[todayKey(d)]?.[appId] ?? 0;
  }
  return total;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function addUsageSeconds(appId: UsageAppId, seconds: number): void {
  if (seconds <= 0) return;
  loadUsage().then((data) => {
    const t = todayKey();
    const day = { ...(data[t] ?? {}) };
    day[appId] = (day[appId] ?? 0) + seconds;
    data[t] = day;
    const keys = Object.keys(data).sort();
    while (keys.length > KEEP_DAYS) {
      const k = keys.shift();
      if (k) delete data[k];
    }
    if (!saveTimer) {
      saveTimer = setTimeout(() => {
        saveTimer = null;
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache ?? {})).catch(
          () => {},
        );
      }, 1000);
    }
  });
}

export function formatMinutes(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export function formatLimit(limitMin: number): string {
  if (limitMin <= 0) return 'no limit';
  return limitMin < 60 ? `${limitMin} min` : `${limitMin / 60}h`;
}
