import Constants, { ExecutionEnvironment } from 'expo-constants';

// True only inside Expo Go (or a dev-client build) — the only
// place the diagnostic panels exist. A standalone / store build
// never shows them, even if the setting was left on. (Austin's
// ask, 2026-11-24: diagnostics are a dev tool, not something
// that ships.)
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
