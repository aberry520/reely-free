import React from 'react';
import SiteBrowser from '../src/components/SiteBrowser';
import { buildMarketplaceGuestScript } from '../src/filters/marketplace-guest';

// Experimental guest Marketplace door (Austin's pick, 2026-11-23).
//
// The mobile site hard-walls Marketplace behind a login; the desktop site
// has historically let a logged-out visitor dismiss the login prompt and
// browse/search. So this door loads the DESKTOP site with a desktop user
// agent, in an incognito WebView fully separate from his real Facebook
// login (see SiteBrowser: no shared cookies), with a filter that
// dismisses the login prompt and hides the login panel/bar.
// Browse/search only — messaging, saving and selling always need an
// account, and Facebook's login/signup pages are blocked outright here
// so the door can't turn into a sign-in screen. "Reset guest" (top
// right) remounts the WebView fresh when the wall stops being
// dismissible.
//
// Location is deliberately NOT set by the app (his decision,
// 2026-11-23): typed city/radius settings and a "use my location"
// toggle both failed to move Facebook, which detects location itself
// for a logged-out session (it found Iva, SC from his IP address) and
// does a good job of it. Anyone who wants somewhere else can change it
// in Marketplace's own location dialog — the WebView geolocation
// support in SiteBrowser and the iOS location usage string in app.json
// stay, so that dialog's location button can work.
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36';

export default function MarketplaceGuestScreen() {
  // Always the plain feed: search happens inside the door, using
  // Marketplace's own search and filter panel (price bands included).
  // A home-screen search launcher that opened this door on a sliced
  // search URL was removed at Austin's call, 2026-11-23 — the in-door
  // search does the same job.
  return (
    <SiteBrowser
      homeUrl="https://www.facebook.com/marketplace/"
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
