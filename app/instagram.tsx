import React from 'react';
import SiteBrowser from '../src/components/SiteBrowser';
import { buildInstagramScript } from '../src/filters/instagram';

// Instagram door (added 2026-11-23, first of the candidate apps Austin
// picked from). The regular mobile web site with the filter layer:
// the feed shows exactly as it comes (hiding feed posts broke
// Instagram's scrolling), but the rabbit holes are closed — no Explore,
// and reels / suggested posts can't be opened into their endless
// viewers. Login persists in the WebView like the other doors.
// Messages, profiles, search and stories are untouched.
export default function InstagramScreen() {
  return (
    <SiteBrowser
      appId="instagram"
      homeUrl="https://www.instagram.com/"
      buildScript={buildInstagramScript}
    />
  );
}
