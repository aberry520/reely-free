import React, { useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { FilterSettings } from '../lib/settings';
import { useSettings } from '../lib/settings';

interface SiteBrowserProps {
  homeUrl: string;
  buildScript: (settings: FilterSettings) => string;
}

// One filtered site in a WebView: the platform's real mobile site with the
// filter layer injected before content loads. Login cookies persist in the
// WebView, so signing in is a one-time thing per site.
export default function SiteBrowser({ homeUrl, buildScript }: SiteBrowserProps) {
  const { settings, loaded } = useSettings();
  const webRef = useRef<WebView>(null);

  // Rebuild (and remount) the WebView when the toggles change so the new
  // rules are the ones injected from the very first paint.
  const script = useMemo(() => buildScript(settings), [buildScript, settings]);

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        key={script}
        ref={webRef}
        source={{ uri: homeUrl }}
        injectedJavaScriptBeforeContentLoaded={script}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        pullToRefreshEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" />
          </View>
        )}
      />
      <View style={styles.toolbar}>
        <Pressable
          style={styles.toolButton}
          onPress={() => webRef.current?.goBack()}
        >
          <Text style={styles.toolText}>‹ Back</Text>
        </Pressable>
        <Pressable
          style={styles.toolButton}
          onPress={() => webRef.current?.reload()}
        >
          <Text style={styles.toolText}>Reload</Text>
        </Pressable>
        <Pressable
          style={styles.toolButton}
          onPress={() => webRef.current?.injectJavaScript(
            `window.location.href = ${JSON.stringify(homeUrl)}; true;`,
          )}
        >
          <Text style={styles.toolText}>Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  toolbar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    backgroundColor: '#f8f8f8',
  },
  toolButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toolText: { fontSize: 15, color: '#0a5cff', fontWeight: '600' },
});
