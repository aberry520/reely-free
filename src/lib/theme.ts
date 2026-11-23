import { useColorScheme } from 'react-native';

// Reely Free follows the phone's own light/dark setting (Austin's request,
// 2026-11-22) — there is no in-app theme toggle. app.json sets
// userInterfaceStyle to "automatic", so the WebViews also report the system
// appearance to Facebook/YouTube, and the sites flip with the phone too.
export interface Theme {
  dark: boolean;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  grabber: string;
  homeBtnBg: string;
  homeBtnGlyph: string;
}

const LIGHT: Theme = {
  dark: false,
  background: '#ffffff',
  surface: '#f2f2f7',
  text: '#111111',
  muted: '#555555',
  border: '#dddddd',
  accent: '#0a5cff',
  grabber: 'rgba(0, 0, 0, 0.35)',
  homeBtnBg: 'rgba(0, 0, 0, 0.45)',
  homeBtnGlyph: '#ffffff',
};

const DARK: Theme = {
  dark: true,
  background: '#000000',
  surface: '#1c1c1e',
  text: '#f5f5f7',
  muted: '#a1a1a6',
  border: '#38383a',
  accent: '#4da3ff',
  grabber: 'rgba(255, 255, 255, 0.45)',
  homeBtnBg: 'rgba(255, 255, 255, 0.32)',
  homeBtnGlyph: '#111111',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
