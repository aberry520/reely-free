import React, { useState } from 'react';
import {
  Pressable,
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

// Group header (Austin's hierarchy, 2026-11-23): "Supported apps" and
// "Getting Home" are plain groupings with NO toggle of their own.
// Tapping the band collapses or re-opens everything under it.
function GroupHeader({
  title,
  collapsed,
  onToggleCollapse,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggleCollapse}
      style={[
        styles.groupHeader,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.groupTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.chevron, { color: theme.muted }]}>
        {collapsed ? '▸' : '▾'}
      </Text>
    </Pressable>
  );
}

// Feature header: one per supported app, carrying that app's master
// switch. The master is a real off switch for the whole feature — off
// means the door leaves the home screen and its toggles below are
// hidden. Tapping the band (not the switch) collapses or re-opens the
// feature's toggles manually, without changing the master.
function FeatureHeader({
  title,
  detail,
  value,
  onChange,
  collapsed,
  onToggleCollapse,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (v: boolean) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.featureHeader,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Pressable style={styles.rowText} onPress={onToggleCollapse}>
        <Text style={[styles.featureTitle, { color: theme.text }]}>
          {title}
          <Text style={[styles.chevronInline, { color: theme.muted }]}>
            {'  '}
            {value ? (collapsed ? '▸' : '▾') : ''}
          </Text>
        </Text>
        <Text style={[styles.rowDetail, { color: theme.muted }]}>
          {detail}
        </Text>
      </Pressable>
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

  // Manual collapse state for each section (view-only; the masters
  // above are the actual feature switches). Everything starts open.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const isCollapsed = (k: string) => !!collapsed[k];
  const toggleCollapse = (k: string) =>
    setCollapsed((prev) => ({ ...prev, [k]: !prev[k] }));

  const appsCollapsed = isCollapsed('apps');
  const showFb =
    !appsCollapsed && settings.featureFacebook && !isCollapsed('facebook');
  const showYt =
    !appsCollapsed && settings.featureYouTube && !isCollapsed('youtube');
  const showGuest =
    !appsCollapsed &&
    settings.featureGuestMarketplace &&
    !isCollapsed('guest');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <GroupHeader
        title="Supported apps"
        collapsed={appsCollapsed}
        onToggleCollapse={() => toggleCollapse('apps')}
      />
      {!appsCollapsed && (
        <>
          <FeatureHeader
            title="Facebook"
            detail="Off = the Facebook door leaves the home screen. Marketplace inside Facebook is never filtered either way."
            value={settings.featureFacebook}
            onChange={set('featureFacebook')}
            collapsed={isCollapsed('facebook')}
            onToggleCollapse={() => toggleCollapse('facebook')}
          />
          {showFb && (
            <>
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
            </>
          )}

          <FeatureHeader
            title="YouTube"
            detail="Off = the YouTube door leaves the home screen."
            value={settings.featureYouTube}
            onChange={set('featureYouTube')}
            collapsed={isCollapsed('youtube')}
            onToggleCollapse={() => toggleCollapse('youtube')}
          />
          {showYt && (
            <>
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
            </>
          )}

          <FeatureHeader
            title="Guest Marketplace"
            detail="The 'Marketplace — no account' door. Off = that door leaves the home screen."
            value={settings.featureGuestMarketplace}
            onChange={set('featureGuestMarketplace')}
            collapsed={isCollapsed('guest')}
            onToggleCollapse={() => toggleCollapse('guest')}
          />
          {showGuest && (
            <>
              <ToggleRow
                label="Dismiss the login prompt"
                detail="Automatically closes Facebook's login prompt so you can keep browsing. Experimental — Facebook may still wall off some listings, and messaging or selling always needs an account. If the wall stops dismissing, use Reset guest on that screen."
                value={settings.mpGuestDismissLogin}
                onChange={set('mpGuestDismissLogin')}
              />
              <ToggleRow
                label="Block the bottom login bar"
                detail="Hides the login prompt bar pinned to the bottom of the guest Marketplace screen."
                value={settings.mpGuestBlockLoginBar}
                onChange={set('mpGuestBlockLoginBar')}
              />
              <ToggleRow
                label="Share via the phone's share sheet"
                detail="Facebook's own share flow needs an account, so tapping Share on a listing opens your phone's share sheet with the listing's link instead — send it by text, mail, or anywhere else."
                value={settings.mpGuestNativeShare}
                onChange={set('mpGuestNativeShare')}
              />
            </>
          )}
        </>
      )}

      <GroupHeader
        title="Getting Home"
        collapsed={isCollapsed('home')}
        onToggleCollapse={() => toggleCollapse('home')}
      />
      {!isCollapsed('home') && (
        <>
          <ToggleRow
            label="Floating home button"
            detail="A movable button that's always on screen. Drag it anywhere; tap it to go home; long-press it and it fans out into the combined control — back (when there's somewhere to go back to) and a jump button for each other app that's turned on."
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
            detail="The back arrow is always in the floating control's fan (long-press the home button). It works when there's a page to go back to — like from a video back to the feed — and sits greyed out when there isn't."
            value={settings.navBackButton}
            onChange={set('navBackButton')}
          />
        </>
      )}

      <Text style={[styles.note, { color: theme.muted }]}>
        Changes apply the next time you open a door. Tap a header to
        collapse or re-open its section. Marketplace inside Facebook is
        never filtered, the guest Marketplace door is separate and
        experimental, and Messenger stays in its own app. The app follows
        your phone's light/dark setting automatically. If you turn every
        way home off, the floating button stays anyway so you can't get stuck.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 26,
    marginBottom: 6,
  },
  groupTitle: { fontSize: 22, fontWeight: '800' },
  chevron: { fontSize: 18, fontWeight: '700' },
  chevronInline: { fontSize: 15, fontWeight: '700' },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
    marginLeft: 14,
    marginBottom: 6,
  },
  featureTitle: { fontSize: 18, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginLeft: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowDetail: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  note: { fontSize: 13, marginTop: 24, lineHeight: 19, paddingBottom: 24 },
});
