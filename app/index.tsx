import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  endFocus,
  formatClock,
  formatFocusLeft,
  getFocusUntil,
  startFocus,
} from '../src/lib/locks';
import {
  formatShortDate,
  getInstallInfo,
  type InstallInfo,
} from '../src/lib/install';
import { useSettings } from '../src/lib/settings';
import { useTheme } from '../src/lib/theme';
import type { UsageAppId } from '../src/lib/usage';
import {
  formatLimit,
  formatMinutes,
  getTodaySeconds,
  getWeekSeconds,
} from '../src/lib/usage';

// One card's usage line: today's time in that door, against its
// daily limit when one is set. Hidden until there's something to
// say (no time yet and no limit set).
function usageLine(
  usage: Partial<Record<UsageAppId, number>>,
  appId: UsageAppId,
  limitMin: number,
): string | null {
  const sec = usage[appId] ?? 0;
  if (sec <= 0 && limitMin <= 0) return null;
  let line = `${formatMinutes(sec)} today`;
  if (limitMin > 0) {
    line += ` of ${formatLimit(limitMin)}`;
    if (sec >= limitMin * 60) line += ' — limit reached';
  }
  return line;
}

// This week's line on a door card, next to today's line.
function weekLine(
  week: Partial<Record<UsageAppId, number>>,
  appId: UsageAppId,
): string | null {
  const sec = week[appId] ?? 0;
  if (sec <= 0) return null;
  return `${formatMinutes(sec)} this week`;
}

const FOCUS_OPTIONS = [15, 25, 45, 60];

// Home: the doors. Facebook, Instagram and YouTube, minus the parts
// designed to keep him scrolling, plus an experimental guest Marketplace door that
// browses without an account. Marketplace also stays in Facebook — he
// sells there. Messenger stays in its own app, by his choice. Colors
// follow the phone's light/dark setting.
//
// Feature masters (Settings): a disabled feature's door leaves the
// home screen entirely. (A "Guest search" launcher card used to live
// under the Marketplace door — query + price-band/sort slices to work
// around Facebook's per-search guest cap. Austin removed it
// 2026-11-23: the search inside the Marketplace door itself does the
// same job, bands included, via its own filter panel.)
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { settings } = useSettings();
  const anyDoor =
    settings.featureFacebook ||
    settings.featureInstagram ||
    settings.featureYouTube ||
    settings.featureGuestMarketplace ||
    settings.featureMarketplaceAccount;

  // Today's and this week's usage per door, refreshed whenever
  // Home is shown. The focus countdown refreshes every 30s.
  const [usage, setUsage] = useState<
    Partial<Record<UsageAppId, number>>
  >({});
  const [weekUsage, setWeekUsage] = useState<
    Partial<Record<UsageAppId, number>>
  >({});
  const [focusUntil, setFocusUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [installInfo, setInstallInfo] = useState<InstallInfo | null>(null);
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
        const focus = await getFocusUntil();
        const install = await getInstallInfo();
        if (live) {
          setUsage(Object.fromEntries(entries));
          setWeekUsage(Object.fromEntries(weekEntries));
          setFocusUntil(focus);
          setInstallInfo(install);
        }
      })();
      const iv = setInterval(() => {
        if (live) setNowMs(Date.now());
      }, 30000);
      return () => {
        live = false;
        clearInterval(iv);
      };
    }, []),
  );
  const focusActive = focusUntil !== null && focusUntil > nowMs;
  const fbUsage = usageLine(usage, 'facebook', settings.fbDailyLimitMin);
  const igUsage = usageLine(usage, 'instagram', settings.igDailyLimitMin);
  const ytUsage = usageLine(usage, 'youtube', settings.ytDailyLimitMin);
  const mpUsage = usageLine(usage, 'marketplace', settings.mpDailyLimitMin);
  const mpaUsage = usageLine(
    usage,
    'marketplaceAccount',
    settings.mpaDailyLimitMin,
  );
  const fbWeek = weekLine(weekUsage, 'facebook');
  const igWeek = weekLine(weekUsage, 'instagram');
  const ytWeek = weekLine(weekUsage, 'youtube');
  const mpWeek = weekLine(weekUsage, 'marketplace');
  const mpaWeek = weekLine(weekUsage, 'marketplaceAccount');
  const weekTotalSec = (
    Object.values(weekUsage) as number[]
  ).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 24 },
      ]}
    >
      <View style={styles.headerRow}>
        {/* Header mark: the icon-only logo, no text version
            (Austin, 2026-11-23). */}
        <Image
          source={require('../assets/logo-mark.png')}
          style={styles.headerMark}
        />
        <Text style={[styles.title, { color: theme.text }]}>Reely Free</Text>
      </View>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Your social apps, without the hooks.
      </Text>
      {weekTotalSec > 0 && (
        <Text style={[styles.weekTotal, { color: theme.muted }]}>
          {formatMinutes(weekTotalSec)} across all doors this week
        </Text>
      )}

      {/* Rebuild countdown (Austin's ask, 2026-11-27): the free
          Apple ID signing expires 7 days after install. A quiet
          line while there's time, a loud banner in the last 2 days
          (or once it's past), with the exact date so he knows the
          deadline. Sideloadly's Wi-Fi auto-refresh may extend it —
          the banner says to rebuild or check Sideloadly. */}
      {installInfo && (
        <View
          style={[
            styles.rebuildCard,
            {
              backgroundColor: installInfo.expiringSoon
                ? theme.accent
                : theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Text
            style={[
              styles.rebuildText,
              {
                color: installInfo.expiringSoon ? '#fff' : theme.text,
              },
            ]}
          >
            {installInfo.expired
              ? `This build expired ${formatShortDate(installInfo.expiresAt)} — re-sideload with Sideloadly to keep using Reely Free.`
              : installInfo.daysLeft <= 1
                ? `Rebuild today — this build expires ${installInfo.daysLeft === 1 ? 'tomorrow' : 'today'} (${formatShortDate(installInfo.expiresAt)}). Re-sideload with Sideloadly, or check its auto-refresh.`
                : installInfo.expiringSoon
                  ? `Rebuild soon — this build expires in ${installInfo.daysLeft} days (${formatShortDate(installInfo.expiresAt)}). Re-sideload with Sideloadly, or check its auto-refresh.`
                  : `This build expires in ${installInfo.daysLeft} days (${formatShortDate(installInfo.expiresAt)}) — rebuild with Sideloadly before then.`}
          </Text>
        </View>
      )}

      {settings.featureFacebook && (
        <Pressable
          style={[styles.card, styles.facebookCard]}
          onPress={() => router.push('/facebook')}
        >
          <Text style={styles.cardTitle}>Facebook</Text>
          <Text style={styles.cardDetail}>
            No Reels, no suggested posts, no sponsored posts. Feed, groups and
            Marketplace stay.
          </Text>
          {fbUsage && <Text style={styles.cardUsage}>{fbUsage}</Text>}
          {fbWeek && <Text style={styles.cardUsage}>{fbWeek}</Text>}
        </Pressable>
      )}

      {settings.featureInstagram && (
        <Pressable
          style={[styles.card, styles.instagramCard]}
          onPress={() => router.push('/instagram')}
        >
          <Text style={styles.cardTitle}>Instagram</Text>
          <Text style={styles.cardDetail}>
            No falling into Reels or suggested posts — they show in the
            feed but won't open. Explore keeps its search, without the
            browse grid. Profiles and messages stay.
          </Text>
          {igUsage && <Text style={styles.cardUsage}>{igUsage}</Text>}
          {igWeek && <Text style={styles.cardUsage}>{igWeek}</Text>}
        </Pressable>
      )}

      {settings.featureYouTube && (
        <Pressable
          style={[styles.card, styles.youtubeCard]}
          onPress={() => router.push('/youtube')}
        >
          <Text style={styles.cardTitle}>YouTube</Text>
          <Text style={styles.cardDetail}>
            No Shorts, no home feed rabbit hole. Opens on your subscriptions.
          </Text>
          {ytUsage && <Text style={styles.cardUsage}>{ytUsage}</Text>}
          {ytWeek && <Text style={styles.cardUsage}>{ytWeek}</Text>}
        </Pressable>
      )}

      {settings.featureGuestMarketplace && (
        <Pressable
          style={[styles.card, styles.marketplaceCard]}
          onPress={() => router.push('/marketplace')}
        >
          <Text style={styles.cardTitle}>Marketplace — no account</Text>
          <Text style={styles.cardDetail}>
            Experimental: browse and search Marketplace without signing in.
            Look only — messaging and selling still need an account.
          </Text>
          {mpUsage && <Text style={styles.cardUsage}>{mpUsage}</Text>}
          {mpWeek && <Text style={styles.cardUsage}>{mpWeek}</Text>}
        </Pressable>
      )}

      {settings.featureMarketplaceAccount && (
        <Pressable
          style={[styles.card, styles.marketplaceAccountCard]}
          onPress={() => router.push('/marketplace-account')}
        >
          <Text style={styles.cardTitle}>Marketplace — with account</Text>
          <Text style={styles.cardDetail}>
            Your Facebook account, Marketplace only. Message buyers, manage
            your listings and sell — the rest of Facebook stays out.
          </Text>
          {mpaUsage && <Text style={styles.cardUsage}>{mpaUsage}</Text>}
          {mpaWeek && <Text style={styles.cardUsage}>{mpaWeek}</Text>}
        </Pressable>
      )}

      {!anyDoor && (
        <Text style={[styles.emptyNote, { color: theme.muted }]}>
          Every feature is turned off right now. Turn one back on in
          Settings and its door comes back here.
        </Text>
      )}

      <View
        style={[
          styles.focusCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.focusTitle, { color: theme.text }]}>
          Focus
        </Text>
        {focusActive && focusUntil ? (
          <>
            <Text style={[styles.focusDetail, { color: theme.muted }]}>
              Every door is paused until {formatClock(focusUntil)} —{' '}
              {formatFocusLeft(focusUntil)}.
            </Text>
            <Pressable
              onPress={async () => {
                await endFocus();
                setFocusUntil(null);
              }}
              style={[styles.focusEnd, { borderColor: theme.border }]}
            >
              <Text style={[styles.focusEndText, { color: theme.text }]}>
                End focus
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.focusDetail, { color: theme.muted }]}>
              Pause every door for a while. Opening one shows a focus
              cover instead of the site, until the timer ends.
            </Text>
            <View style={styles.chipRow}>
              {FOCUS_OPTIONS.map((min) => (
                <Pressable
                  key={min}
                  onPress={async () => {
                    const until = await startFocus(min);
                    setFocusUntil(until);
                    setNowMs(Date.now());
                  }}
                  style={[
                    styles.chip,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.accent,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: '#fff' }]}>
                    {min}m
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>

      <Pressable
        style={styles.settingsButton}
        onPress={() => router.push('/settings')}
      >
        <Text style={[styles.settingsText, { color: theme.accent }]}>
          Settings
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerMark: { width: 46, height: 46, borderRadius: 11 },
  title: { fontSize: 32, fontWeight: '800' },
  subtitle: { fontSize: 16, marginTop: 6, marginBottom: 28 },
  card: {
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
  },
  facebookCard: { backgroundColor: '#1877f2' },
  instagramCard: { backgroundColor: '#c13584' },
  youtubeCard: { backgroundColor: '#c4302b' },
  marketplaceCard: { backgroundColor: '#0f766e' },
  marketplaceAccountCard: { backgroundColor: '#1e40af' },
  cardUsage: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 10,
  },
  weekTotal: { fontSize: 14, marginTop: -16, marginBottom: 20 },
  rebuildCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  rebuildText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  focusCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  focusTitle: { fontSize: 18, fontWeight: '700' },
  focusDetail: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  focusEnd: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  focusEndText: { fontSize: 14, fontWeight: '600' },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  cardDetail: { fontSize: 14, color: '#eef', marginTop: 6, lineHeight: 20 },
  emptyNote: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  settingsButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  settingsText: { fontSize: 16, fontWeight: '600' },
});
