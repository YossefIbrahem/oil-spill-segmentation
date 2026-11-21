// Root of the app. Three screens, switched with a simple state variable (no navigation library needed).
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ImageSource, loadServerUrl, ModelInfo, PredictResult, saveServerUrl } from './src/api';
import HomeScreen from './src/screens/HomeScreen';
import ResultScreen from './src/screens/ResultScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors } from './src/theme';

type Screen = 'home' | 'result' | 'settings';
type Analysis = { result: PredictResult; source: ImageSource; models: ModelInfo[] };

export default function App() {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  // Load the saved server address once
  useEffect(() => {
    loadServerUrl().then(setServerUrl);
  }, []);

  // Android back button: go back to the home screen instead of closing the app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'home') return false;
      setScreen('home');
      return true;
    });
    return () => sub.remove();
  }, [screen]);

  if (!serverUrl) {
    return (
      <View style={[styles.root, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.root}>
        {/* Home stays mounted (only hidden) so its choices are kept when you come back.
            key={serverUrl}: a new server address starts a fresh Home screen. */}
        <View style={[styles.root, screen !== 'home' && styles.hidden]}>
          <HomeScreen
            key={serverUrl}
            serverUrl={serverUrl}
            onOpenSettings={() => setScreen('settings')}
            onResult={(result, source, models) => {
              setAnalysis({ result, source, models });
              setScreen('result');
            }}
          />
        </View>

        {screen === 'result' && analysis && (
          <ResultScreen
            {...analysis}
            serverUrl={serverUrl}
            onBack={() => setScreen('home')}
            onNewResult={(result) => setAnalysis({ ...analysis, result })}
          />
        )}

        {screen === 'settings' && (
          <SettingsScreen
            serverUrl={serverUrl}
            onBack={() => setScreen('home')}
            onSave={async (url) => {
              await saveServerUrl(url);
              setServerUrl(url);
              setScreen('home');
            }}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hidden: { display: 'none' },
});
