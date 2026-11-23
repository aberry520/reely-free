import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Home: two doors. Facebook and YouTube, minus the parts designed to keep
// him scrolling. Marketplace stays — he sells there. Messenger stays in its
// own app, by his choice.
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>Reely Free</Text>
      <Text style={styles.subtitle}>
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
        style={styles.settingsButton}
        onPress={() => router.push('/settings')}
      >
        <Text style={styles.settingsText}>Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '800', color: '#111' },
  subtitle: { fontSize: 16, color: '#555', marginTop: 6, marginBottom: 28 },
  card: {
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
  },
  facebookCard: { backgroundColor: '#1877f2' },
  youtubeCard: { backgroundColor: '#c4302b' },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  cardDetail: { fontSize: 14, color: '#eef', marginTop: 6, lineHeight: 20 },
  settingsButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  settingsText: { fontSize: 16, color: '#0a5cff', fontWeight: '600' },
});
