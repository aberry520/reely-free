import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/lib/theme';

// Home: three doors. Facebook and YouTube, minus the parts designed to
// keep him scrolling, plus an experimental guest Marketplace door that
// browses without an account. Marketplace also stays in Facebook — he
// sells there. Messenger stays in its own app, by his choice. Colors
// follow the phone's light/dark setting.
//
// Under the guest card sits the guest search launcher (his pick,
// 2026-11-23). Facebook caps each logged-out pool — ~40 cards in the
// feed, ~72 per search — but every distinct search is its own pool, so
// the launcher opens the guest door on a search slice: the query plus a
// price band and a sort. Stepping through the bands for one item steps
// through separate pools, surfacing far more than any single search.
const BANDS: { label: string; min?: string; max?: string }[] = [
  { label: 'All prices' },
  { label: 'Under $50', max: '50' },
  { label: '$50–$150', min: '50', max: '150' },
  { label: '$150–$400', min: '150', max: '400' },
  { label: '$400+', min: '400' },
];

const SORTS: { label: string; value?: string }[] = [
  { label: 'Best match' },
  { label: 'Newest', value: 'creation_time_descend' },
  { label: 'Price ↑', value: 'price_ascend' },
  { label: 'Price ↓', value: 'price_descend' },
];

function ChipRow<T extends { label: string }>({
  options,
  selected,
  onSelect,
}: {
  options: T[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chipRow}>
      {options.map((o, i) => {
        const on = i === selected;
        return (
          <Pressable
            key={o.label}
            onPress={() => onSelect(i)}
            style={[
              styles.chip,
              {
                backgroundColor: on ? '#0f766e' : theme.surface,
                borderColor: on ? '#0f766e' : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: on ? '#ffffff' : theme.text },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [band, setBand] = useState(0);
  const [sort, setSort] = useState(0);

  const runSearch = () => {
    const q = query.trim();
    if (!q) {
      router.push('/marketplace');
      return;
    }
    const params: Record<string, string> = { q };
    const b = BANDS[band];
    if (b.min) params.min = b.min;
    if (b.max) params.max = b.max;
    const s = SORTS[sort];
    if (s.value) params.sort = s.value;
    router.push({ pathname: '/marketplace', params });
  };

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

      <View
        style={[
          styles.launcher,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.launcherTitle, { color: theme.text }]}>
          Guest search
        </Text>
        <Text style={[styles.launcherDetail, { color: theme.muted }]}>
          Facebook shows a guest only so many results per search — but each
          price band below is a separate batch. Step through the bands to
          see more of the same item.
        </Text>
        <TextInput
          style={[
            styles.searchInput,
            {
              color: theme.text,
              borderColor: theme.border,
              backgroundColor: theme.background,
            },
          ]}
          value={query}
          onChangeText={setQuery}
          placeholder="What are you looking for?"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={runSearch}
        />
        <ChipRow options={BANDS} selected={band} onSelect={setBand} />
        <ChipRow options={SORTS} selected={sort} onSelect={setSort} />
        <Pressable style={styles.searchButton} onPress={runSearch}>
          <Text style={styles.searchButtonText}>Search as guest</Text>
        </Pressable>
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
  launcher: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  launcherTitle: { fontSize: 17, fontWeight: '700' },
  launcherDetail: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  searchButton: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  searchButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  settingsButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  settingsText: { fontSize: 16, fontWeight: '600' },
});
