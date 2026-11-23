import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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

function TextRow({
  label,
  detail,
  value,
  onSave,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  detail: string;
  value: string;
  onSave: (v: string) => void;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'words';
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const save = () => {
    if (draft !== value) onSave(draft.trim());
  };
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.rowDetail, { color: theme.muted }]}>
          {detail}
        </Text>
      </View>
      <TextInput
        style={[
          styles.textInput,
          {
            color: theme.text,
            borderColor: theme.border,
            backgroundColor: theme.background,
          },
        ]}
        value={draft}
        onChangeText={setDraft}
        onEndEditing={save}
        onSubmitEditing={save}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        returnKeyType="done"
      />
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
      <ToggleRow
        label="Block app popups"
        detail="Hides the 'Get the best experience' popup and the Open App button in the header."
        value={settings.ytBlockAppPromo}
        onChange={set('ytBlockAppPromo')}
      />
      <ToggleRow
        label="Swipe down on video to go back"
        detail="Swipe down on the playing video to return to the feed, like the app. The video stops — the web version has no mini-player to shrink into."
        value={settings.ytSwipeDownBack}
        onChange={set('ytSwipeDownBack')}
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
      <ToggleRow
        label="Block 'Open app' bar"
        detail="Hides the Open app bar at the bottom of the feed and similar get-the-app banners."
        value={settings.fbBlockAppPromo}
        onChange={set('fbBlockAppPromo')}
      />
      <ToggleRow
        label="Header returns on scroll up"
        detail="Like the app: the top bar scrolls away going down and comes back as soon as you scroll up, instead of only at the very top."
        value={settings.fbStickyHeader}
        onChange={set('fbStickyHeader')}
      />

      <Text style={[styles.section, { color: theme.text }]}>
        Guest Marketplace
      </Text>
      <ToggleRow
        label="Dismiss the login prompt"
        detail="On the 'Marketplace — no account' door: automatically closes Facebook's login prompt so you can keep browsing. Experimental — Facebook may still wall off some listings, and messaging or selling always needs an account. If the wall stops dismissing, use Reset guest on that screen."
        value={settings.mpGuestDismissLogin}
        onChange={set('mpGuestDismissLogin')}
      />
      <ToggleRow
        label="Block the bottom login bar"
        detail="Hides the login prompt bar pinned to the bottom of the guest Marketplace screen."
        value={settings.mpGuestBlockLoginBar}
        onChange={set('mpGuestBlockLoginBar')}
      />
      <TextRow
        label="Guest location"
        detail="City the guest door opens on — a city name, not a ZIP (Facebook's location links use city names). Applies the next time you open the door."
        value={settings.mpGuestLocation}
        onSave={(v) => update({ mpGuestLocation: v })}
        autoCapitalize="words"
      />
      <TextRow
        label="Guest radius (miles)"
        detail="How far around that city the guest door asks Marketplace to show. Applies the next time you open the door."
        value={settings.mpGuestRadiusMiles}
        onSave={(v) => update({ mpGuestRadiusMiles: v })}
        keyboardType="number-pad"
      />

      <Text style={[styles.section, { color: theme.text }]}>Getting home</Text>
      <ToggleRow
        label="Floating home button"
        detail="A movable button that's always on screen. Drag it anywhere; tap it to go home."
        value={settings.navButton}
        onChange={set('navButton')}
      />
      <ToggleRow
        label="Dismiss from bottom"
        detail="Swipe up on the bar at the bottom center. iOS often steals this gesture for itself, so it can be hit or miss."
        value={settings.navBottomSwipe}
        onChange={set('navBottomSwipe')}
      />
      <ToggleRow
        label="Dismiss from left"
        detail="Swipe in from the left edge — the standard iOS back gesture."
        value={settings.navLeftEdge}
        onChange={set('navLeftEdge')}
      />
      <ToggleRow
        label="Dismiss from right"
        detail="Swipe in from the right edge of the screen."
        value={settings.navRightEdge}
        onChange={set('navRightEdge')}
      />
      <ToggleRow
        label="Back button"
        detail="A small floating button appears whenever there's a page to go back to — like from a video back to the feed. It hides itself when there's nowhere to go back to."
        value={settings.navBackButton}
        onChange={set('navBackButton')}
      />

      <Text style={[styles.note, { color: theme.muted }]}>
        Changes apply the next time you open a door. Marketplace inside
        Facebook is never filtered, the guest Marketplace door is separate
        and experimental, and Messenger stays in its own app. The app follows
        your phone's light/dark setting automatically. If you turn every
        way home off, the floating button stays anyway so you can't get stuck.
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
  textInput: {
    width: 110,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    textAlign: 'right',
  },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowDetail: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  note: { fontSize: 13, marginTop: 24, lineHeight: 19 },
});
