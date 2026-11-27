import CookieManager, {
  type Cookie,
} from '@preeternal/react-native-cookie-manager';
import * as SecureStore from 'expo-secure-store';

// Stay logged in across reinstalls (Austin's ask, 2026-11-27):
// sideloading a new build wipes the WebView's cookies, so every
// reinstall used to mean logging back into Facebook, YouTube and
// Instagram. Instead the session cookies for each site are saved
// into the iPhone Keychain (expo-secure-store) and restored on
// launch, so the doors open already logged in.
//
// The WebView's cookies live in the WebKit store (WKHTTPCookieStore),
// not the Foundation store, so every read/write here passes
// { iosCookieStore: 'webKit' }. The guest Marketplace door is
// incognito (its own ephemeral store) and stays logged out by
// design, so it has no session entry here. The Marketplace-with-
// account door shares the Facebook login, so facebook.com covers it.
//
// Security note: these are session cookies — whoever holds them can
// act as the user on that site until they expire. They live only in
// the Keychain (encrypted, survives reinstalls, never leaves the
// device) and in the WebView's own cookie store. They are never
// logged, never sent anywhere, and never stored in AsyncStorage
// or the sheet. Deleting the app's Keychain entry (or logging out
// in a door) clears them.

type SessionDomain = { key: string; url: string };

const SESSION_DOMAINS: SessionDomain[] = [
  { key: 'facebook.com', url: 'https://www.facebook.com' },
  { key: 'google.com', url: 'https://www.google.com' },
  { key: 'youtube.com', url: 'https://www.youtube.com' },
  { key: 'instagram.com', url: 'https://www.instagram.com' },
];

// Which session domains belong to each door, for the "do I have a
// saved login" check that drives the first-time autofill hint.
export const DOOR_SESSION_KEYS: Record<string, string[]> = {
  facebook: ['facebook.com'],
  instagram: ['instagram.com'],
  youtube: ['google.com', 'youtube.com'],
  marketplaceAccount: ['facebook.com'],
  // marketplace (guest) is logged out by design — no session.
  marketplace: [],
};

const STORE_KEY = (domainKey: string) => `reelyfree-session-${domainKey}`;
const WEBKIT = { iosCookieStore: 'webKit' as const };

// Save the current WebKit cookies for every session domain into the
// Keychain. Called when the app backgrounds and when leaving a door.
// Best-effort: a failure on one domain never blocks the others, and
// this never throws. A domain with no cookies clears its stale saved
// copy, so logging out in a door doesn't resurrect an old session.
export async function saveSessionCookies(): Promise<void> {
  for (const { key, url } of SESSION_DOMAINS) {
    try {
      const cookies = await CookieManager.getAsArray(url, WEBKIT);
      if (cookies.length === 0) {
        await SecureStore.deleteItemAsync(STORE_KEY(key));
        continue;
      }
      await SecureStore.setItemAsync(
        STORE_KEY(key),
        JSON.stringify(cookies),
      );
    } catch {
      // Best-effort per domain.
    }
  }
}

// Restore every saved session cookie into the WebKit store, so the
// doors open logged in. Must run — and finish — before a door's
// WebView loads its first page. Best-effort; never throws.
export async function restoreSessionCookies(): Promise<void> {
  for (const { key, url } of SESSION_DOMAINS) {
    try {
      const raw = await SecureStore.getItemAsync(STORE_KEY(key));
      if (!raw) continue;
      let cookies: Cookie[];
      try {
        cookies = JSON.parse(raw) as Cookie[];
      } catch {
        continue;
      }
      if (!Array.isArray(cookies)) continue;
      for (const cookie of cookies) {
        if (!cookie || typeof cookie.name !== 'string') continue;
        try {
          await CookieManager.set(url, cookie, WEBKIT);
        } catch {
          // One bad or expired cookie must not block the rest.
        }
      }
    } catch {
      // Best-effort per domain.
    }
  }
  try {
    await CookieManager.flush();
  } catch {
    // Ignore.
  }
}

// Does a saved session exist for any of the given domain keys?
// Used by the first-time autofill hint: no saved session means the
// user hasn't logged in on this door yet.
export async function hasSavedSession(domainKeys: string[]): Promise<boolean> {
  for (const key of domainKeys) {
    try {
      const raw = await SecureStore.getItemAsync(STORE_KEY(key));
      if (!raw) continue;
      const cookies = JSON.parse(raw) as unknown;
      if (Array.isArray(cookies) && cookies.length > 0) return true;
    } catch {
      // Treat as no session.
    }
  }
  return false;
}

// Module-level restore promise: the app kicks it off at startup and
// doors wait for it before showing their WebView, so the restored
// cookies are in place before the first page load. A single promise
// means the restore runs once even if several doors mount at once.
let restorePromise: Promise<void> | null = null;
export function ensureSessionRestored(): Promise<void> {
  if (!restorePromise) {
    restorePromise = restoreSessionCookies();
  }
  return restorePromise;
}
