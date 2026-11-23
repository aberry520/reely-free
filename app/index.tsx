import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../src/lib/settings';
import { useTheme } from '../src/lib/theme';

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
    settings.featureGuestMarketplace;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 24 },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>Reely Free</Text>
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
