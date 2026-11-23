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
import { useSettings } from '../src/lib/settings';
import { useTheme } from '../src/lib/theme';
import type { UsageAppId } from '../src/lib/usage';
import { formatLimit, formatMinutes, getTodaySeconds } from '../src/lib/usage';

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

  // Today's usage per door, refreshed whenever Home is shown.
  const [usage, setUsage] = useState<
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
        if (live) setUsage(Object.fromEntries(entries));
      })();
      return () => {
        live = false;
      };
    }, []),
  );
  const fbUsage = usageLine(usage, 'facebook', settings.fbDailyLimitMin);
  const igUsage = usageLine(usage, 'instagram', settings.igDailyLimitMin);
  const ytUsage = usageLine(usage, 'youtube', settings.ytDailyLimitMin);
  const mpUsage = usageLine(usage, 'marketplace', settings.mpDailyLimitMin);
  const mpaUsage = usageLine(
    usage,
    'marketplaceAccount',
    settings.mpaDailyLimitMin,
  );

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
        </Pressable>
      )}

      {!anyDoor && (
        <Text style={[styles.emptyNote, { color: theme.muted }]}>
          Every feature is turned off right now. Turn one back on in
          Settings and its door comes back here.
        </Text>
      )}

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
