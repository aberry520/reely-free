import React from 'react';
import SiteBrowser from '../src/components/SiteBrowser';
import { buildFacebookScript } from '../src/filters/facebook';

export default function FacebookScreen() {
  return (
    <SiteBrowser
      appId="facebook"
      homeUrl="https://www.facebook.com/"
      buildScript={buildFacebookScript}
    />
  );
}
