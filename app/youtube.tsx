import React from 'react';
import SiteBrowser from '../src/components/SiteBrowser';
import { buildYouTubeScript } from '../src/filters/youtube';

export default function YouTubeScreen() {
  return (
    <SiteBrowser
      appId="youtube"
      homeUrl="https://m.youtube.com/"
      buildScript={buildYouTubeScript}
      // On a watch page a downward drag is the swipe-to-go-back gesture,
      // so pull-to-refresh is disabled there (it still works on feeds).
      noRefreshPaths={['/watch']}
    />
  );
}
