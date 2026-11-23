import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UsageAppId } from './usage';
import { todayKey } from './usage';

// Locks beyond the daily-limit cover (Austin's ask, 2026-11-23):
// a manual one-tap lock from the fan, a per-door bedtime, and a
// focus timer that pauses every door. All of it stays on the phone.

// --- Manual lock: one door, until tomorrow -----------------------
// Stored as the date the lock was set; it counts as locked while
// that date is today. Tomorrow it simply isn't locked any more.
const MANUAL_LOCK_KEY = 'reelyfree-manual-lock-v1';

type ManualLockData = Partial<Record<UsageAppId, string>>;

async function loadManualLocks(): Promise<ManualLockData> {
  try {
    const raw = await AsyncStorage.getItem(MANUAL_LOCK_KEY);
    return raw ? (JSON.parse(raw) as ManualLockData) : {};
  } catch {
    return {};
  }
}

export async function isManualLocked(appId: UsageAppId): Promise<boolean> {
  const data = await loadManualLocks();
  return data[appId] === todayKey();
}

export async function lockManually(appId: UsageAppId): Promise<void> {
  const data = await loadManualLocks();
  data[appId] = todayKey();
  await AsyncStorage.setItem(MANUAL_LOCK_KEY, JSON.stringify(data)).catch(
    () => {},
  );
}

export async function unlockManually(appId: UsageAppId): Promise<void> {
  const data = await loadManualLocks();
  delete data[appId];
  await AsyncStorage.setItem(MANUAL_LOCK_KEY, JSON.stringify(data)).catch(
    () => {},
  );
}

// --- Bedtime: a door locks from its bedtime hour until 5 AM ------
// bedtimeHour: 0 = off, 21 = 9 PM, 22 = 10 PM, 23 = 11 PM,
// 24 = midnight. Pure function of the hour, so the door can check
// it on every render.
export function isBedtimeNow(bedtimeHour: number): boolean {
  if (!bedtimeHour) return false;
  const h = new Date().getHours();
  if (h < 5) return true;
  if (bedtimeHour === 24) return false;
  return h >= bedtimeHour;
}

export function formatBedtime(bedtimeHour: number): string {
  if (bedtimeHour === 24) return 'midnight';
  if (bedtimeHour === 12) return 'noon';
  if (bedtimeHour > 12) return `${bedtimeHour - 12} PM`;
  return `${bedtimeHour} AM`;
}

// --- Focus: every door paused until a timestamp ------------------
const FOCUS_KEY = 'reelyfree-focus-v1';

export async function startFocus(minutes: number): Promise<number> {
  const until = Date.now() + minutes * 60 * 1000;
  await AsyncStorage.setItem(
    FOCUS_KEY,
    JSON.stringify({ until }),
  ).catch(() => {});
  return until;
}

export async function getFocusUntil(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(FOCUS_KEY);
    if (!raw) return null;
    const { until } = JSON.parse(raw) as { until: number };
    if (!until || until <= Date.now()) return null;
    return until;
  } catch {
    return null;
  }
}

export async function endFocus(): Promise<void> {
  await AsyncStorage.removeItem(FOCUS_KEY).catch(() => {});
}

export function formatFocusLeft(until: number): string {
  const ms = Math.max(0, until - Date.now());
  const min = Math.ceil(ms / 60000);
  if (min < 1) return 'under a minute left';
  if (min < 60) return `${min} min left`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem ? `${h}h ${rem}m left` : `${h}h left`;
}

export function formatClock(until: number): string {
  const d = new Date(until);
  let h = d.getHours();
  const m = `${d.getMinutes()}`.padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}
