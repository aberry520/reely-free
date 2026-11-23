import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/lib/theme';

// Home: three doors. Facebook and YouTube, minus the parts designed to
// keep him scrolling, plus an experimental guest Marketplace door that
// browses without an account. Marketplace also stays in Facebook — he
// sells there. Messenger stays in its own app, by his choice. Colors
// follow the phone's light/dark setting.
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, backgroundColor: theme.background },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>Reely Free</Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Facebook and YouTube, without the hooks.
      </Text>

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

      <Pressable
        style={[styles.card, styles.youtubeCard]}
        onPress={() => router.push('/youtube')}
      >
        <Text style={styles.cardTitle}>YouTube</Text>
        <Text style={styles.cardDetail}>
          No Shorts, no home feed rabbit hole. Opens on your subscriptions.
        </Text>
      </Pressable>

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

      <Pressable
        style={styles.settingsButton}
        onPress={() => router.push('/settings')}
      >
        <Text style={[styles.settingsText, { color: theme.accent }]}>
          Settings
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: '800' },
  subtitle: { fontSize: 16, marginTop: 6, marginBottom: 28 },
  card: {
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
  },
  facebookCard: { backgroundColor: '#1877f2' },
  youtubeCard: { backgroundColor: '#c4302b' },
  marketplaceCard: { backgroundColor: '#0f766e' },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  cardDetail: { fontSize: 14, color: '#eef', marginTop: 6, lineHeight: 20 },
  settingsButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  settingsText: { fontSize: 16, fontWeight: '600' },
});
