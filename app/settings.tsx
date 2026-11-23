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
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const set =
    (key: keyof FilterSettings) =>
    (v: boolean) =>
      update({ [key]: v });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.section}>YouTube</Text>
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

      <Text style={styles.section}>Facebook</Text>
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

      <Text style={styles.note}>
        Changes apply the next time you open Facebook or YouTube. Marketplace
        is never filtered, and Messenger stays in its own app.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  section: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginTop: 24,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#111' },
  rowDetail: { fontSize: 13, color: '#555', marginTop: 3, lineHeight: 18 },
  note: { fontSize: 13, color: '#777', marginTop: 24, lineHeight: 19 },
});
