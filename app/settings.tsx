import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type { FilterSettings } from '../src/lib/settings';
import { useSettings } from '../src/lib/settings';
import { useTheme } from '../src/lib/theme';

function ToggleRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.rowDetail, { color: theme.muted }]}>
          {detail}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const theme = useTheme();
  const set =
    (key: keyof FilterSettings) =>
    (v: boolean) =>
      update({ [key]: v });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Text style={[styles.section, { color: theme.text }]}>YouTube</Text>
      <ToggleRow
        label="Block Shorts"
        detail="Hides Shorts shelves and the Shorts button. A Shorts link someone sends you opens as a normal video instead."
        value={settings.ytBlockShorts}
        onChange={set('ytBlockShorts')}
      />
      <ToggleRow
        label="Open on Subscriptions"
        detail="YouTube's home page redirects to your subscriptions feed."
        value={settings.ytLandOnSubs}
        onChange={set('ytLandOnSubs')}
      />
      <ToggleRow
        label="Hide Up Next"
        detail="Hides the autoplaying list of follow-on videos on watch pages."
        value={settings.ytHideUpNext}
        onChange={set('ytHideUpNext')}
      />

      <Text style={[styles.section, { color: theme.text }]}>Facebook</Text>
      <ToggleRow
        label="Block Reels"
        detail="Hides Reels in the feed and Watch, and the shortcuts that lead to them."
        value={settings.fbBlockReels}
        onChange={set('fbBlockReels')}
      />
      <ToggleRow
        label="Hide suggested posts"
        detail="Hides every 'Suggested for you' post — pages, groups and people Facebook recommends."
        value={settings.fbHideSuggested}
        onChange={set('fbHideSuggested')}
      />
      <ToggleRow
        label="Hide sponsored posts"
        detail="Hides posts labelled Sponsored. Best effort — some ad formats slip through."
        value={settings.fbHideSponsored}
        onChange={set('fbHideSponsored')}
      />

      <Text style={[styles.note, { color: theme.muted }]}>
        Changes apply the next time you open Facebook or YouTube. Marketplace
        is never filtered, and Messenger stays in its own app. The app follows
        your phone's light/dark setting automatically.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  section: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowDetail: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  note: { fontSize: 13, marginTop: 24, lineHeight: 19 },
});
