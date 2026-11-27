import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

// Rebuild countdown (Austin's ask, 2026-11-27): the sideloaded
// build is signed with a free Apple ID, whose provisioning expires
// 7 days after install. This counts down to that expiry so the
// Home screen can remind him to re-sideload before it runs out.
//
// The install time comes from expo-application's
// getInstallationTimeAsync(), which reads the real iOS install
// date — that stays correct when Sideloadly installs a new build
// over the old one, where an AsyncStorage "first launch" stamp
// would go stale (app data survives an in-place update). The
// AsyncStorage stamp is only a fallback if the native call fails.
//
// Caveat: Sideloadly's daemon can auto-refresh the signing over
// Wi-Fi, which extends the real expiry without reinstalling — the
// countdown can't see that, so it may read early. Being early is
// safe for a reminder; the banner says to rebuild or check
// Sideloadly.

const INSTALL_KEY = 'reelyfree-installed-at';
const PROVISION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type InstallInfo = {
  installedAt: Date;
  expiresAt: Date;
  // Whole days left, rounded up (so "1 day left" on the last day).
  daysLeft: number;
  expiringSoon: boolean;
  expired: boolean;
};

async function readInstallDate(): Promise<Date> {
  try {
    const native = await Application.getInstallationTimeAsync();
    if (native && !Number.isNaN(native.getTime())) return native;
  } catch {
    // Fall through to the AsyncStorage stamp.
  }
  try {
    const stored = await AsyncStorage.getItem(INSTALL_KEY);
    if (stored) {
      const d = new Date(Number(stored));
      if (!Number.isNaN(d.getTime())) return d;
    }
    const now = new Date();
    await AsyncStorage.setItem(INSTALL_KEY, String(now.getTime()));
    return now;
  } catch {
    return new Date();
  }
}

export async function getInstallInfo(now = new Date()): Promise<InstallInfo> {
  const installedAt = await readInstallDate();
  const expiresAt = new Date(installedAt.getTime() + PROVISION_DAYS * DAY_MS);
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
  return {
    installedAt,
    expiresAt,
    daysLeft,
    expiringSoon: daysLeft <= 2,
    expired: daysLeft <= 0,
  };
}

// Short date for the banner, e.g. "Dec 4".
export function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
