import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import SiteBrowser from '../src/components/SiteBrowser';
import { buildMarketplaceGuestScript } from '../src/filters/marketplace-guest';
import { useSettings } from '../src/lib/settings';
import { useTheme } from '../src/lib/theme';

// Experimental guest Marketplace door (Austin's pick, 2026-11-23).
//
// The mobile site hard-walls Marketplace behind a login; the desktop site
// has historically let a logged-out visitor dismiss the login prompt and
// browse/search. So this door loads the DESKTOP site with a desktop user
// agent, in an incognito WebView fully separate from his real Facebook
// login (see SiteBrowser: no shared cookies), with a filter that
// dismisses the login prompt and hides the bottom login bar.
// Browse/search only — messaging, saving and selling always need an
// account, and Facebook's login/signup pages are blocked outright here
// so the door can't turn into a sign-in screen. "Reset guest" (top
// right) remounts the WebView fresh when the wall stops being
// dismissible.
//
// Location (his asks, 2026-11-23): by default "Use my location" is on
// and the door sends no location at all — Facebook detects where the
// device is (his screenshot: Iva, SC, from the IP address) and the
// typed slug/radius were overridden for a logged-out session anyway.
// With the toggle off, the door opens on the city typed in Settings,
// via Facebook's location slug — the path segment in
// facebook.com/marketplace/<slug>/, the city name lowercased with spaces
// and punctuation removed ("San Francisco" -> "sanfrancisco"). ZIPs do
// not work in that segment. The radius from Settings (miles) is sent as
// the radius URL parameter converted to kilometres, which is what
// Marketplace deep links use; the on-page "Within X mi" chip is the
// check that Facebook honoured it.
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36';

function guestHomeUrl(
  useMyLocation: boolean,
  location: string,
  radiusMiles: string,
): string {
  // "Use my location" (his pick): send no location at all. For a
  // logged-out session Facebook ignores the slug/radius in the URL and
  // uses the location it detects for the device anyway (his screenshot:
  // Iva, South Carolina, detected from the IP address) — so the honest
  // version of the feature is to get out of its way.
  if (useMyLocation) return 'https://www.facebook.com/marketplace/';
  const slug = (location.split(',')[0] || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  const miles = parseInt(radiusMiles, 10);
  const radiusKm =
    Number.isFinite(miles) && miles > 0 ? Math.round(miles * 1.60934) : 0;
  const base = slug
    ? `https://www.facebook.com/marketplace/${slug}/`
    : 'https://www.facebook.com/marketplace/';
  return radiusKm > 0 ? `${base}?radius=${radiusKm}` : base;
}

export default function MarketplaceGuestScreen() {
  const { settings, loaded } = useSettings();
  const theme = useTheme();

  if (!loaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <SiteBrowser
      homeUrl={guestHomeUrl(
        settings.mpGuestUseMyLocation,
        settings.mpGuestLocation,
        settings.mpGuestRadiusMiles,
      )}
      buildScript={buildMarketplaceGuestScript}
      userAgent={DESKTOP_UA}
      incognito
      resettable
      blockUrlFragments={[
        'facebook.com/login',
        'facebook.com/reg',
        'facebook.com/checkpoint',
        'facebook.com/r.php',
      ]}
    />
  );
}
