import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { FilterSettings } from '../src/lib/settings';
import { useSettings } from '../src/lib/settings';
import { isExpoGo } from '../src/lib/is-expo-go';
import { useTheme } from '../src/lib/theme';
import type { UsageAppId } from '../src/lib/usage';
import {
  formatMinutes,
  getTodaySeconds,
  getWeekSeconds,
} from '../src/lib/usage';

function ToggleRow({
  label,
  detail,
  value,
  onChange,
  query,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (v: boolean) => void;
  // Settings search (Austin's ask, 2026-11-27): when a query is
  // set, a row only renders if its label or detail contains it.
  query?: string;
}) {
  const theme = useTheme();
  const q = (query ?? '').trim().toLowerCase();
  if (q && !(label + ' ' + detail).toLowerCase().includes(q)) {
    return null;
  }
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

const LIMIT_OPTIONS = [
  { v: 0, l: 'Off' },
  { v: 15, l: '15m' },
  { v: 30, l: '30m' },
  { v: 60, l: '1h' },
  { v: 120, l: '2h' },
  { v: 240, l: '4h' },
];

// Bedtime per door (Austin's ask, 2026-11-23): the hour after
// which the door locks until 5 AM. 0 = off, 24 = midnight.
const BEDTIME_OPTIONS = [
  { v: 0, l: 'Off' },
  { v: 21, l: '9 PM' },
  { v: 22, l: '10 PM' },
  { v: 23, l: '11 PM' },
  { v: 24, l: '12 AM' },
];

// What two quick taps on the floating Reely Free button do
// (Austin's ask, 2026-11-23). None = no double-tap action.
const DOUBLE_TAP_OPTIONS: {
  v: FilterSettings['hubDoubleTap'];
  l: string;
}[] = [
  { v: 'none', l: 'None' },
  { v: 'back', l: 'Back' },
  { v: 'home', l: 'Home' },
  { v: 'settings', l: 'Settings' },
  { v: 'lastDoor', l: 'Last door' },
];

// The daily-usage rows at the foot of each app's block (Austin's
// ask, 2026-11-23): today's time in that door, a chip row to set
// the daily limit, and the lock/warn choice for what happens at
// the cap. Time counts only while the door is open in Reely Free.
function UsageLimitRows({
  usedSec,
  weekSec,
  limitMin,
  onChangeLimit,
  lock,
  onChangeLock,
  bedtimeHour,
  onChangeBedtime,
  query,
}: {
  usedSec: number;
  weekSec: number;
  limitMin: number;
  onChangeLimit: (v: number) => void;
  lock: boolean;
  onChangeLock: (v: boolean) => void;
  bedtimeHour: number;
  onChangeBedtime: (v: number) => void;
  // Settings search (Austin's ask, 2026-11-27): the block only
  // renders if the query hits any of its three sections (daily
  // limit, lock, bedtime). A hit shows the whole block.
  query?: string;
}) {
  const theme = useTheme();
  const q = (query ?? '').trim().toLowerCase();
  if (
    q &&
    !(
      'daily limit used today this week time counts only while this door is open'
        .toLowerCase()
        .includes(q) ||
      'lock when the limit is reached on the door is covered for the rest of the day off a warning banner shows from 5 minutes out instead and the door keeps working'
        .toLowerCase()
        .includes(q) ||
      'bedtime the door locks from this hour until 5 am off no bedtime'
        .toLowerCase()
        .includes(q)
    )
  ) {
    return null;
  }
  return (
    <>
      <View style={[styles.row, { borderBottomColor: theme.border }]}>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>
            Daily limit
          </Text>
          <Text style={[styles.rowDetail, { color: theme.muted }]}>
            Used today: {formatMinutes(usedSec)} · this week:{' '}
            {formatMinutes(weekSec)}. Time counts only while this
            door is open in Reely Free — time in the real app isn't
            tracked.
          </Text>
          <View style={styles.chipRow}>
            {LIMIT_OPTIONS.map((o) => {
              const active = limitMin === o.v;
              return (
                <Pressable
                  key={o.v}
                  onPress={() => onChangeLimit(o.v)}
                  style={[
                    styles.chip,
                    {
                      borderColor: theme.border,
                      backgroundColor: active
                        ? theme.accent
                        : theme.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? '#fff' : theme.text },
                    ]}
                  >
                    {o.l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <ToggleRow
        label="Lock when the limit is reached"
        detail="On: the door is covered for the rest of the day. Off: a warning banner shows from 5 minutes out instead, and the door keeps working."
        value={lock}
        onChange={onChangeLock}
       query={query} />
      <View style={[styles.row, { borderBottomColor: theme.border }]}>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>
            Bedtime
          </Text>
          <Text style={[styles.rowDetail, { color: theme.muted }]}>
            The door locks from this hour until 5 AM. Off = no
            bedtime.
          </Text>
          <View style={styles.chipRow}>
            {BEDTIME_OPTIONS.map((o) => {
              const active = bedtimeHour === o.v;
              return (
                <Pressable
                  key={o.v}
                  onPress={() => onChangeBedtime(o.v)}
                  style={[
                    styles.chip,
                    {
                      borderColor: theme.border,
                      backgroundColor: active
                        ? theme.accent
                        : theme.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? '#fff' : theme.text },
                    ]}
                  >
                    {o.l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </>
  );
}

// Group header (Austin's hierarchy, 2026-11-23): "Supported apps" and
// "Getting Home" are plain groupings with NO toggle of their own.
// Tapping the band collapses or re-opens everything under it.
function GroupHeader({
  title,
  collapsed,
  onToggleCollapse,
  query,
  searchText,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  // Settings search (Austin's ask, 2026-11-27): a group header
  // only renders when the query hits something under it
  // (searchText = the group's rows' labels and titles).
  query?: string;
  searchText?: string;
}) {
  const theme = useTheme();
  const q = (query ?? '').trim().toLowerCase();
  if (q && !(title + ' ' + (searchText ?? '')).toLowerCase().includes(q)) {
    return null;
  }
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
  query,
  rowLabels,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (v: boolean) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  // Settings search (Austin's ask, 2026-11-27): a feature's header
  // only renders when the query hits its own title/detail or any
  // of its rows' labels (rowLabels).
  query?: string;
  rowLabels?: string;
}) {
  const theme = useTheme();
  const q = (query ?? '').trim().toLowerCase();
  if (
    q &&
    !(title + ' ' + detail + ' ' + (rowLabels ?? ''))
      .toLowerCase()
      .includes(q)
  ) {
    return null;
  }
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
  // Settings search (Austin's ask, 2026-11-27): type to filter
  // every row by its label or detail. While searching, collapse
  // is ignored (matching rows show even in a collapsed section)
  // but a feature's master switch still gates its sub-toggles.
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = (text: string) =>
    !q || text.toLowerCase().includes(q);
  // Row labels per feature, for deciding whether a feature's
  // header shows during a search (a header shows when its own
  // title/detail matches or any of its rows does).
  const featureLabels: Record<string, string> = {
    facebook:
      'Block Reels Hide suggested posts Hide sponsored posts Block Open app bar Header returns on scroll up Reely Free header Open Messenger app Daily limit Lock when the limit is reached Bedtime',
    instagram:
      'Block opening Reels Hide Explore content Block opening suggested posts Block app banners Reely Free header Daily limit Lock when the limit is reached Bedtime',
    youtube:
      'Block Shorts Open on Subscriptions Hide Up Next Block app popups Swipe down on video to go back Reely Free header Daily limit Lock when the limit is reached Bedtime',
    guest:
      'Dismiss the login prompt Block the bottom login bar Share via the phone share sheet Reely Free header Daily limit Lock when the limit is reached Bedtime',
    mpaccount:
      'Stay in Marketplace Allow messages Open Messenger app Block Open app bar Reely Free header Daily limit Lock when the limit is reached Bedtime',
  };
  // Search text for each group header: the titles and row labels
  // under that group, so the header only shows when something
  // beneath it matches.
  const appsSearchText =
    'Facebook Instagram YouTube Guest Marketplace Marketplace with account ' +
    Object.values(featureLabels).join(' ');
  const homeSearchText =
    'Floating home button Dismiss from bottom Dismiss from left Dismiss from right Back button Double-tap floating button';
  const diagSearchText = 'Diagnostic panels';
  const set =
    (key: keyof FilterSettings) =>
    (v: boolean) =>
      update({ [key]: v });
  const setNum =
    (key: keyof FilterSettings) =>
    (v: number) =>
      update({ [key]: v } as Partial<FilterSettings>);

  // Today's and this week's usage per door, refreshed whenever
  // Settings is opened.
  const [usage, setUsage] = useState<
    Partial<Record<UsageAppId, number>>
  >({});
  const [weekUsage, setWeekUsage] = useState<
    Partial<Record<UsageAppId, number>>
  >({});
  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const ids: UsageAppId[] = [
          'facebook',
          'instagram',
          'youtube',
          'marketplace',
          'marketplaceAccount',
        ];
        const entries = await Promise.all(
          ids.map(
            async (id) => [id, await getTodaySeconds(id)] as const,
          ),
        );
        const weekEntries = await Promise.all(
          ids.map(
            async (id) => [id, await getWeekSeconds(id)] as const,
          ),
        );
        if (live) {
          setUsage(Object.fromEntries(entries));
          setWeekUsage(Object.fromEntries(weekEntries));
        }
      })();
      return () => {
        live = false;
      };
    }, []),
  );

  // Manual collapse state for each section (view-only; the masters
  // above are the actual feature switches). Everything starts open.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const isCollapsed = (k: string) => !!collapsed[k];
  const toggleCollapse = (k: string) =>
    setCollapsed((prev) => ({ ...prev, [k]: !prev[k] }));

  const appsCollapsed = isCollapsed('apps');
  // While searching, collapse is ignored so a matching row shows
  // even in a collapsed section; the feature master still gates
  // its sub-toggles.
  const searching = q.length > 0;
  const showFb =
    settings.featureFacebook &&
    (searching || (!appsCollapsed && !isCollapsed('facebook')));
  const showIg =
    settings.featureInstagram &&
    (searching || (!appsCollapsed && !isCollapsed('instagram')));
  const showYt =
    settings.featureYouTube &&
    (searching || (!appsCollapsed && !isCollapsed('youtube')));
  const showGuest =
    settings.featureGuestMarketplace &&
    (searching || (!appsCollapsed && !isCollapsed('guest')));
  const showMpAccount =
    settings.featureMarketplaceAccount &&
    (searching || (!appsCollapsed && !isCollapsed('mpaccount')));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search settings"
        placeholderTextColor={theme.muted}
        clearButtonMode="while-editing"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.searchInput,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            color: theme.text,
          },
        ]}
      />
      <GroupHeader
        title="Supported apps"
        collapsed={appsCollapsed}
        onToggleCollapse={() => toggleCollapse('apps')}
      
        query={query}
        searchText={appsSearchText}
      />
      {(searching || !appsCollapsed) && (
        <>
          <FeatureHeader
            title="Facebook"
            detail="Off = the Facebook door leaves the home screen. Marketplace inside Facebook is never filtered either way."
            value={settings.featureFacebook}
            onChange={set('featureFacebook')}
            collapsed={isCollapsed('facebook')}
            onToggleCollapse={() => toggleCollapse('facebook')}
          
          query={query}
          rowLabels={featureLabels.facebook}
        />
          {showFb && (
            <>
              <ToggleRow
                label="Block Reels"
                detail="Hides Reels in the feed and covers Reels sections with the Reely Free logo. Videos in the feed open and play like normal, but the full-screen viewer can't be swiped — it stays on the video you tapped instead of streaming endless others, and a back button at the top left takes you back to the feed. Reels themselves stay blocked. Shortcuts that lead to Reels stay, with the Reely Free icon in place of the Reels icon, and do nothing when tapped."
                value={settings.fbBlockReels}
                onChange={set('fbBlockReels')}
               query={query} />
              <ToggleRow
                label="Hide suggested posts"
                detail="Hides every 'Suggested for you' post — pages, groups and people Facebook recommends."
                value={settings.fbHideSuggested}
                onChange={set('fbHideSuggested')}
               query={query} />
              <ToggleRow
                label="Hide sponsored posts"
                detail="Hides posts labelled Sponsored. Best effort — some ad formats slip through."
                value={settings.fbHideSponsored}
                onChange={set('fbHideSponsored')}
               query={query} />
              <ToggleRow
                label="Block 'Open app' bar"
                detail="Hides the Open app bar at the bottom of the feed and similar get-the-app banners."
                value={settings.fbBlockAppPromo}
                onChange={set('fbBlockAppPromo')}
               query={query} />
              <ToggleRow
                label="Header returns on scroll up"
                detail="Like the app: the top bar scrolls away going down and comes back as soon as you scroll up, instead of only at the very top."
                value={settings.fbStickyHeader}
                onChange={set('fbStickyHeader')}
               query={query} />
              <ToggleRow
                label="Reely Free header"
                detail="The Reely Free mark sits in the top bar, between the Facebook logo and the search button. The tabs and everything else keep working."
                value={settings.fbBrandHeader}
                onChange={set('fbBrandHeader')}
               query={query} />
              <ToggleRow
                label="Open Messenger app"
                detail="Tapping a message link opens the Messenger app to that conversation instead of loading messages in here. Facebook's mobile web pushes its own app for messaging; this goes straight to Messenger."
                value={settings.fbOpenMessenger}
                onChange={set('fbOpenMessenger')}
               query={query} />
              <UsageLimitRows
                usedSec={usage.facebook ?? 0}
                weekSec={weekUsage.facebook ?? 0}
                limitMin={settings.fbDailyLimitMin}
                onChangeLimit={setNum('fbDailyLimitMin')}
                lock={settings.fbLimitLock}
                onChangeLock={set('fbLimitLock')}
                bedtimeHour={settings.fbBedtimeHour}
                onChangeBedtime={setNum('fbBedtimeHour')}
                 query={query} />
            </>
          )}

          <FeatureHeader
            title="Instagram"
            detail="Off = the Instagram door leaves the home screen."
            value={settings.featureInstagram}
            onChange={set('featureInstagram')}
            collapsed={isCollapsed('instagram')}
            onToggleCollapse={() => toggleCollapse('instagram')}
          
          query={query}
          rowLabels={featureLabels.instagram}
        />
          {showIg && (
            <>
              <ToggleRow
                label="Block opening Reels"
                detail="Reels still show in the feed, but tapping one does nothing — you can't fall into the swipe-through Reels viewer. The Reels entry shows the Reely Free icon instead of the Reels icon, and the Reels feed sends you home."
                value={settings.igBlockReels}
                onChange={set('igBlockReels')}
               query={query} />
              <ToggleRow
                label="Hide Explore content"
                detail="Search lives on the Explore page, so the page and its button stay — a Reely Free logo cover sits over the browse grid under the search bar instead. Search itself, and its results, work normally."
                value={settings.igHideExplore}
                onChange={set('igHideExplore')}
               query={query} />
              <ToggleRow
                label="Block opening suggested posts"
                detail="Suggested posts still show in the feed, but tapping into one does nothing. (Hiding feed posts outright broke Instagram's scrolling, so the feed is left exactly as it comes.)"
                value={settings.igHideSuggested}
                onChange={set('igHideSuggested')}
               query={query} />
              <ToggleRow
                label="Block app banners"
                detail="Hides 'Open app' bars and similar get-the-app banners."
                value={settings.igBlockAppPromo}
                onChange={set('igBlockAppPromo')}
               query={query} />
              <ToggleRow
                label="Reely Free header"
                detail="A 'Reely' and 'Free' header with the Reely Free mark sits centered at the top of the screen, in the middle of the top bar. Nothing else changes."
                value={settings.igBrandHeader}
                onChange={set('igBrandHeader')}
               query={query} />
              <UsageLimitRows
                usedSec={usage.instagram ?? 0}
                weekSec={weekUsage.instagram ?? 0}
                limitMin={settings.igDailyLimitMin}
                onChangeLimit={setNum('igDailyLimitMin')}
                lock={settings.igLimitLock}
                onChangeLock={set('igLimitLock')}
                bedtimeHour={settings.igBedtimeHour}
                onChangeBedtime={setNum('igBedtimeHour')}
                 query={query} />
            </>
          )}

          <FeatureHeader
            title="YouTube"
            detail="Off = the YouTube door leaves the home screen."
            value={settings.featureYouTube}
            onChange={set('featureYouTube')}
            collapsed={isCollapsed('youtube')}
            onToggleCollapse={() => toggleCollapse('youtube')}
          
          query={query}
          rowLabels={featureLabels.youtube}
        />
          {showYt && (
            <>
              <ToggleRow
                label="Block Shorts"
                detail="Hides Shorts shelves. The Shorts button stays, with the Reely Free icon in place of its own, and does nothing when tapped. A Shorts link someone sends you opens as a normal video instead."
                value={settings.ytBlockShorts}
                onChange={set('ytBlockShorts')}
               query={query} />
              <ToggleRow
                label="Open on Subscriptions"
                detail="YouTube's home page redirects to your subscriptions feed."
                value={settings.ytLandOnSubs}
                onChange={set('ytLandOnSubs')}
               query={query} />
              <ToggleRow
                label="Hide Up Next"
                detail="Hides the autoplaying list of follow-on videos on watch pages."
                value={settings.ytHideUpNext}
                onChange={set('ytHideUpNext')}
               query={query} />
              <ToggleRow
                label="Block app popups"
                detail="Hides the 'Get the best experience' popup and the Open App button in the header."
                value={settings.ytBlockAppPromo}
                onChange={set('ytBlockAppPromo')}
               query={query} />
              <ToggleRow
                label="Swipe down on video to go back"
                detail="Swipe down on the playing video to return to the feed, like the app. The video stops — the web version has no mini-player to shrink into."
                value={settings.ytSwipeDownBack}
                onChange={set('ytSwipeDownBack')}
               query={query} />
              <ToggleRow
                label="Reely Free header"
                detail="A 'Reely' and 'Free' header with the Reely Free mark sits centered at the top of the screen, in the middle of the top bar. Nothing else changes."
                value={settings.ytBrandHeader}
                onChange={set('ytBrandHeader')}
               query={query} />
              <UsageLimitRows
                usedSec={usage.youtube ?? 0}
                weekSec={weekUsage.youtube ?? 0}
                limitMin={settings.ytDailyLimitMin}
                onChangeLimit={setNum('ytDailyLimitMin')}
                lock={settings.ytLimitLock}
                onChangeLock={set('ytLimitLock')}
                bedtimeHour={settings.ytBedtimeHour}
                onChangeBedtime={setNum('ytBedtimeHour')}
                 query={query} />
            </>
          )}

          <FeatureHeader
            title="Guest Marketplace"
            detail="The 'Marketplace — no account' door. Off = that door leaves the home screen."
            value={settings.featureGuestMarketplace}
            onChange={set('featureGuestMarketplace')}
            collapsed={isCollapsed('guest')}
            onToggleCollapse={() => toggleCollapse('guest')}
          
          query={query}
          rowLabels={featureLabels.guest}
        />
          {showGuest && (
            <>
              <ToggleRow
                label="Dismiss the login prompt"
                detail="Automatically closes Facebook's login prompt so you can keep browsing. Experimental — Facebook may still wall off some listings, and messaging or selling always needs an account. If the wall stops dismissing, use Reset guest on that screen."
                value={settings.mpGuestDismissLogin}
                onChange={set('mpGuestDismissLogin')}
               query={query} />
              <ToggleRow
                label="Block the bottom login bar"
                detail="Hides the login prompt bar pinned to the bottom of the guest Marketplace screen."
                value={settings.mpGuestBlockLoginBar}
                onChange={set('mpGuestBlockLoginBar')}
               query={query} />
              <ToggleRow
                label="Share via the phone's share sheet"
                detail="Facebook's own share flow needs an account, so tapping Share on a listing opens your phone's share sheet with the listing's link instead — send it by text, mail, or anywhere else."
                value={settings.mpGuestNativeShare}
                onChange={set('mpGuestNativeShare')}
               query={query} />
              <ToggleRow
                label="Reely Free header"
                detail="The Facebook logo at the top left becomes the Reely Free mark. Tapping it still goes home, and search stays."
                value={settings.mpGuestBrandHeader}
                onChange={set('mpGuestBrandHeader')}
               query={query} />
              <UsageLimitRows
                usedSec={usage.marketplace ?? 0}
                weekSec={weekUsage.marketplace ?? 0}
                limitMin={settings.mpDailyLimitMin}
                onChangeLimit={setNum('mpDailyLimitMin')}
                lock={settings.mpLimitLock}
                onChangeLock={set('mpLimitLock')}
                bedtimeHour={settings.mpBedtimeHour}
                onChangeBedtime={setNum('mpBedtimeHour')}
                 query={query} />
            </>
          )}

          <FeatureHeader
            title="Marketplace — with account"
            detail="Your Facebook account, but only Marketplace — the rest of Facebook is ignored. Off = that door leaves the home screen."
            value={settings.featureMarketplaceAccount}
            onChange={set('featureMarketplaceAccount')}
            collapsed={isCollapsed('mpaccount')}
            onToggleCollapse={() => toggleCollapse('mpaccount')}
          
          query={query}
          rowLabels={featureLabels.mpaccount}
        />
          {showMpAccount && (
            <>
              <ToggleRow
                label="Stay in Marketplace"
                detail="Taps that would leave Marketplace — the feed, Watch, groups, profiles — do nothing, and anything that lands elsewhere on Facebook is sent back to Marketplace. Signing in still works normally."
                value={settings.mpaStayInMarketplace}
                onChange={set('mpaStayInMarketplace')}
               query={query} />
              <ToggleRow
                label="Allow messages"
                detail="Message threads stay reachable, so you can talk to buyers and sellers. Off = Marketplace only, no messages."
                value={settings.mpaAllowMessages}
                onChange={set('mpaAllowMessages')}
               query={query} />
              <ToggleRow
                label="Open Messenger app"
                detail="Tapping Message (or Send) on a listing opens the Messenger app to that seller instead of hitting Facebook's 'use the app' prompt, which blocks messaging on the mobile web."
                value={settings.mpaOpenMessenger}
                onChange={set('mpaOpenMessenger')}
               query={query} />
              <ToggleRow
                label="Block 'Open app' bar"
                detail="Hides the 'Open app' bar pinned to the bottom of Marketplace, like the Facebook door does."
                value={settings.mpaBlockAppPromo}
                onChange={set('mpaBlockAppPromo')}
               query={query} />
              <ToggleRow
                label="Reely Free header"
                detail="Covers Facebook's icon bar at the very top with a Reely Free strip — the logo with 'Reely' and 'Free' either side. Marketplace's own header underneath stays."
                value={settings.mpaBrandHeader}
                onChange={set('mpaBrandHeader')}
               query={query} />
              <UsageLimitRows
                usedSec={usage.marketplaceAccount ?? 0}
                weekSec={weekUsage.marketplaceAccount ?? 0}
                limitMin={settings.mpaDailyLimitMin}
                onChangeLimit={setNum('mpaDailyLimitMin')}
                lock={settings.mpaLimitLock}
                onChangeLock={set('mpaLimitLock')}
                bedtimeHour={settings.mpaBedtimeHour}
                onChangeBedtime={setNum('mpaBedtimeHour')}
                 query={query} />
            </>
          )}
        </>
      )}

      <GroupHeader
        title="Getting Home"
        collapsed={isCollapsed('home')}
        onToggleCollapse={() => toggleCollapse('home')}
      
        query={query}
        searchText={homeSearchText}
      />
      {(searching || !isCollapsed('home')) && (
        <>
          <ToggleRow
            label="Floating home button"
            detail="The Reely Free icon, always on screen. Drag it anywhere; tap it and it fans out into the combined control — Home, Back (greyed out when there's nowhere to go back to), a jump button for each other app that's turned on, and Settings."
            value={settings.navButton}
            onChange={set('navButton')}
           query={query} />
          <ToggleRow
            label="Dismiss from bottom"
            detail="Swipe up on the bar at the bottom center. iOS often steals this gesture for itself, so it can be hit or miss."
            value={settings.navBottomSwipe}
            onChange={set('navBottomSwipe')}
           query={query} />
          <ToggleRow
            label="Dismiss from left"
            detail="Swipe in from the left edge — the standard iOS back gesture."
            value={settings.navLeftEdge}
            onChange={set('navLeftEdge')}
           query={query} />
          <ToggleRow
            label="Dismiss from right"
            detail="Swipe in from the right edge of the screen."
            value={settings.navRightEdge}
            onChange={set('navRightEdge')}
           query={query} />
          <ToggleRow
            label="Back button"
            detail="The back arrow is always in the floating control's fan (tap the Reely Free button). It works when there's a page to go back to — like from a video back to the feed — and sits greyed out when there isn't."
            value={settings.navBackButton}
            onChange={set('navBackButton')}
           query={query} />
          {matches(
            'Double-tap floating button What two quick taps on the Reely Free button do',
          ) && (
            <View style={[styles.row, { borderBottomColor: theme.border }]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>
                  Double-tap floating button
                </Text>
              <Text style={[styles.rowDetail, { color: theme.muted }]}>
                What two quick taps on the Reely Free button do. A
                single tap still opens the menu. Last door jumps back
                to the door you were in before this one.
              </Text>
              <View style={styles.chipRow}>
                {DOUBLE_TAP_OPTIONS.map((o) => {
                  const active = settings.hubDoubleTap === o.v;
                  return (
                    <Pressable
                      key={o.v}
                      onPress={() => update({ hubDoubleTap: o.v })}
                      style={[
                        styles.chip,
                        {
                          borderColor: theme.border,
                          backgroundColor: active
                            ? theme.accent
                            : theme.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? '#fff' : theme.text },
                        ]}
                      >
                        {o.l}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
          )}
        </>
      )}

      {/* Diagnostics only exist in Expo Go (Austin's ask,
          2026-11-24): a standalone / store build never shows this
          section at all. */}
      {isExpoGo && (
        <>
          <GroupHeader
            title="Diagnostics"
            collapsed={isCollapsed('diagnostics')}
            onToggleCollapse={() => toggleCollapse('diagnostics')}
          
        query={query}
        searchText={diagSearchText}
      />
          {(searching || !isCollapsed('diagnostics')) && (
            <>
              <ToggleRow
                label="Diagnostic panels"
                detail="Shows a small panel at the bottom of each door reporting what that door's filter sees — the page, the videos, what got blocked or covered. Turn it on when testing a new feature, off when you're done."
                value={settings.diagnosticsEnabled}
                onChange={set('diagnosticsEnabled')}
               query={query} />
            </>
          )}
        </>
      )}

      {!searching && (
        <Text style={[styles.note, { color: theme.muted }]}>
          Changes apply the next time you open a door. Tap a header to
          collapse or re-open its section. Marketplace inside Facebook is
          never filtered, the guest Marketplace door is separate and
          experimental, and Messenger stays in its own app. The app follows
          your phone's light/dark setting automatically. If you turn every
          way home off, the floating button stays anyway so you can't get stuck.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    marginTop: 16,
  },
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowDetail: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  note: { fontSize: 13, marginTop: 24, lineHeight: 19, paddingBottom: 24 },
});
