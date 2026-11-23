import React from 'react';
import SiteBrowser from '../src/components/SiteBrowser';
import { buildMarketplaceAccountScript } from '../src/filters/marketplace-account';

// Marketplace door WITH his account (Austin's ask, 2026-11-23).
//
// Same Facebook login as the Facebook door (shared session — sign
// in once, both doors work), but this door opens on Marketplace
// and ignores the rest of Facebook: the filter keeps him in
// Marketplace (plus message threads, so he can talk to buyers and
// sellers) and sends anything else — feed, Watch, groups,
// profiles — back to Marketplace. Selling, saving and messaging
// all work here, unlike the guest door.
export default function MarketplaceAccountScreen() {
  return (
    <SiteBrowser
      appId="marketplaceAccount"
      homeUrl="https://www.facebook.com/marketplace"
      buildScript={buildMarketplaceAccountScript}
    />
  );
}
