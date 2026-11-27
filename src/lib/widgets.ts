import DoorsWidget, { type WidgetDoor } from '../widgets/doors-widget';
import type { FilterSettings } from './settings';

// Pushes the enabled-doors list to the home screen widget
// (src/widgets/doors-widget.tsx). The widget only renders what the
// app gives it, so the app re-pushes whenever the enabled doors
// change (see SettingsProvider) and on launch. Each door carries
// its deep link (reelyfree://<route>); tapping it in the widget
// opens the app to that door via expo-router. No-ops in Expo Go /
// web / any build without the widget extension.

type DoorDef = {
  key:
    | 'featureFacebook'
    | 'featureInstagram'
    | 'featureYouTube'
    | 'featureGuestMarketplace'
    | 'featureMarketplaceAccount';
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  route: string;
};

const ALL_DOORS: DoorDef[] = [
  {
    key: 'featureFacebook',
    id: 'facebook',
    label: 'Facebook',
    shortLabel: 'Facebook',
    color: '#1877f2',
    route: '/facebook',
  },
  {
    key: 'featureInstagram',
    id: 'instagram',
    label: 'Instagram',
    shortLabel: 'Instagram',
    color: '#c13584',
    route: '/instagram',
  },
  {
    key: 'featureYouTube',
    id: 'youtube',
    label: 'YouTube',
    shortLabel: 'YouTube',
    color: '#c4302b',
    route: '/youtube',
  },
  {
    key: 'featureGuestMarketplace',
    id: 'marketplace',
    label: 'Marketplace — no account',
    shortLabel: 'MP Guest',
    color: '#0f766e',
    route: '/marketplace',
  },
  {
    key: 'featureMarketplaceAccount',
    id: 'marketplaceAccount',
    label: 'Marketplace — with account',
    shortLabel: 'MP Acct',
    color: '#1e40af',
    route: '/marketplace-account',
  },
];

export function doorsForWidget(settings: FilterSettings): WidgetDoor[] {
  return ALL_DOORS.filter((d) => settings[d.key]).map((d) => ({
    id: d.id,
    label: d.label,
    shortLabel: d.shortLabel,
    color: d.color,
    url: `reelyfree://${d.route.slice(1)}`,
  }));
}

export function pushDoorsWidgetSnapshot(settings: FilterSettings): void {
  try {
    DoorsWidget.updateSnapshot({ doors: doorsForWidget(settings) });
    // Force the system to refresh the widget immediately; the
    // snapshot alone was not reaching it on Austin's phone.
    DoorsWidget.reload();
  } catch {
    // Widget extension unavailable (Expo Go, web, older build).
  }
}
