import React from 'react';
import SiteBrowser from '../src/components/SiteBrowser';
import { buildFacebookScript } from '../src/filters/facebook';

export default function FacebookScreen() {
  return (
    <SiteBrowser
      homeUrl="https://www.facebook.com/"
      buildScript={buildFacebookScript}
    />
  );
}
