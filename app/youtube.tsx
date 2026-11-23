import React from 'react';
import SiteBrowser from '../src/components/SiteBrowser';
import { buildYouTubeScript } from '../src/filters/youtube';

export default function YouTubeScreen() {
  return (
    <SiteBrowser
      homeUrl="https://m.youtube.com/"
      buildScript={buildYouTubeScript}
    />
  );
}
