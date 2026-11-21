// Settings: server address + information about the trained models.
import { Ionicons } from '@react-native-vector-icons/ionicons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, defaultServerUrl, ModelInfo, pct } from '../api';
import { Card, ClassDot, IconButton, Legend, PrimaryButton, SecondaryButton, SectionTitle } from '../components';
import { CLASSES, colors, radius, spacing } from '../theme';

type Props = {
  serverUrl: string;
  onSave: (url: string) => void;
  onBack: () => void;
};

export default function SettingsScreen({ serverUrl, onSave, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState(serverUrl);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    api.models(serverUrl).then(setModels).catch(() => setModels([]));
  }, [serverUrl]);

  async function testConnection() {
    setTesting(true);
    setTestMessage(null);
    try {
      const health = await api.health(url.trim());
      setTestMessage({
        ok: true,
        text: `Connected · ${health.models.length} model(s) · running on ${health.device.toUpperCase()}`,
      });
    } catch (e: any) {
      setTestMessage({ ok: false, text: e.message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.page, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topBar}>
          <IconButton icon="arrow-back" onPress={onBack} />
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* ---------- server ---------- */}
        <Card>
          <SectionTitle icon="server-outline" title="Server address" />
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="http://192.168.1.5:8000"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
          <Pressable onPress={() => setUrl(defaultServerUrl())}>
            <Text style={styles.link}>Use the default ({defaultServerUrl()})</Text>
          </Pressable>
          <View style={styles.buttonRow}>
            <SecondaryButton label="Test connection" icon="wifi-outline" onPress={testConnection} style={{ flex: 1 }} />
          </View>
          {testing && <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />}
          {testMessage && (
            <View style={styles.testRow}>
              <Ionicons
                name={testMessage.ok ? 'checkmark-circle' : 'close-circle-outline'}
                size={18}
                color={testMessage.ok ? colors.success : colors.danger}
              />
              <Text style={[styles.testText, { color: testMessage.ok ? colors.success : colors.danger }]}>
                {testMessage.text}
              </Text>
            </View>
          )}
          <View style={{ marginTop: spacing.md }}>
            <PrimaryButton label="Save" icon="save-outline" onPress={() => onSave(url.trim())} disabled={!url.trim()} />
          </View>
        </Card>

        {/* ---------- help ---------- */}
        <Card>
          <SectionTitle icon="information-circle-outline" title="How to connect your phone" />
          {[
            'On your computer, run:  python app.py  inside the backend folder.',
            'It prints the address to use, e.g. http://192.168.1.5:8000',
            'Your phone and computer must be on the same Wi-Fi network.',
            'Type that address above, press Test connection, then Save.',
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </Card>

        {/* ---------- models & metrics ---------- */}
        {models.length > 0 && (
          <Card>
            <SectionTitle icon="flask-outline" title="Trained models (test set)" />
            {models.map((m) => (
              <View key={m.id} style={styles.modelBlock}>
                <Text style={styles.modelName}>
                  {m.name} <Text style={styles.modelDetail}>· {m.experiment}</Text>
                </Text>
                <Text style={styles.modelDetail}>
                  mIoU {pct(m.test_miou)} · pixel accuracy {pct(m.test_pixel_acc)} · val mIoU {pct(m.val_miou)}
                </Text>
                {m.test_iou && (
                  <View style={styles.iouGrid}>
                    {CLASSES.map((c) => (
                      <View key={c.id} style={styles.iouChip}>
                        <ClassDot color={c.color} size={9} />
                        <Text style={styles.iouText}>
                          {c.name} {pct(m.test_iou?.[c.id])}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}

        {/* ---------- about ---------- */}
        <Card>
          <SectionTitle icon="planet" title="About" />
          <Text style={styles.about}>
            The app sends a SAR (Synthetic Aperture Radar) satellite image to the server. A semantic-segmentation
            network assigns every pixel to one of five classes. U-Net was trained from scratch; DeepLabV3+ uses an
            ImageNet-pretrained ResNet-34 encoder. Both were trained on the Oil Spill Detection Dataset (Krestenitis et
            al., Remote Sensing 2019).
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <Legend />
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.md },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  link: { color: colors.accent, fontSize: 13, marginTop: 8, marginBottom: 12 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  testText: { fontSize: 14, flex: 1 },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 10, alignItems: 'flex-start' },
  stepNumber: {
    color: colors.accent,
    fontWeight: '800',
    width: 22,
    height: 22,
    textAlign: 'center',
    lineHeight: 22,
    borderRadius: 11,
    backgroundColor: colors.accent + '22',
    overflow: 'hidden',
  },
  stepText: { color: colors.text, fontSize: 14, lineHeight: 21, flex: 1 },
  modelBlock: { marginBottom: 14, gap: 4 },
  modelName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  modelDetail: { color: colors.muted, fontSize: 13, fontWeight: '400' },
  iouGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  iouChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  iouText: { color: colors.text, fontSize: 12 },
  about: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
