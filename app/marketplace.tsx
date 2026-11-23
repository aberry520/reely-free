import React from 'react';
import SiteBrowser from '../src/components/SiteBrowser';
import { buildMarketplaceGuestScript } from '../src/filters/marketplace-guest';

// Experimental guest Marketplace door (Austin's pick, 2026-11-23).
//
// The mobile site hard-walls Marketplace behind a login; the desktop site
// has historically let a logged-out visitor dismiss the login prompt and
// browse/search. So this door loads the DESKTOP site with a desktop user
// agent, in an incognito WebView that never touches his real Facebook
// login, with a filter that dismisses the login prompt. Browse/search
// only — messaging, saving and selling always need an account, and
// Facebook's login/signup pages are blocked outright here so the door
// can't turn into a sign-in screen. "Reset guest" (top right) remounts
// the WebView fresh when the wall stops being dismissible.
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36';

export default function MarketplaceGuestScreen() {
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
