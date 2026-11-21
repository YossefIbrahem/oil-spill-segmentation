// Home: pick a model, pick an image, press "Analyze".
import { Ionicons } from '@react-native-vector-icons/ionicons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ImageSource, ModelInfo, pct, PredictResult, Sample } from '../api';
import {
  Card,
  ErrorBanner,
  IconButton,
  Legend,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  StatusPill,
} from '../components';
import { colors, gradients, radius, spacing } from '../theme';

type Props = {
  serverUrl: string;
  onOpenSettings: () => void;
  onResult: (result: PredictResult, source: ImageSource, models: ModelInfo[]) => void;
};

// Turn a picked image into base64 (works on phones and on the web).
async function toBase64(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  if (asset.base64) return asset.base64;
  if (asset.uri.startsWith('data:')) return asset.uri;
  const blob = await (await fetch(asset.uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Ask the server for its models and sample images. Never throws: errors come back as a message.
async function loadServerData(serverUrl: string) {
  try {
    await api.health(serverUrl);
    const [models, samples] = await Promise.all([api.models(serverUrl), api.samples(serverUrl)]);
    return { models, samples, error: null };
  } catch (e: any) {
    return { models: [] as ModelInfo[], samples: [] as Sample[], error: `${e.message}\nServer: ${serverUrl}` };
  }
}

export default function HomeScreen({ serverUrl, onOpenSettings, onResult }: Props) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [source, setSource] = useState<ImageSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0); // increase to reconnect

  // Load the models + sample images when the screen opens (and on every retry)
  useEffect(() => {
    let active = true; // ignore answers that arrive after the screen changed
    loadServerData(serverUrl).then((data) => {
      if (!active) return;
      setModels(data.models);
      setSamples(data.samples);
      setStatus(data.error ? 'offline' : 'online');
      setError(data.error);
      // keep the current choice if it still exists, otherwise prefer DeepLabV3+
      setModelId((current) =>
        current && data.models.some((m) => m.id === current)
          ? current
          : (data.models.find((m) => m.architecture === 'deeplab') ?? data.models[0])?.id ?? null,
      );
    });
    return () => {
      active = false;
    };
  }, [serverUrl, attempt]);

  // tapping the status pill retries
  function retry() {
    setStatus('checking');
    setAttempt((n) => n + 1);
  }

  async function pickImage(fromCamera: boolean) {
    setError(null);
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(`Permission to use the ${fromCamera ? 'camera' : 'photo library'} was denied.`);
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, base64: true };
    const picked = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled) return;
    const asset = picked.assets[0];
    setSource({ kind: 'upload', uri: asset.uri, base64: await toBase64(asset) });
  }

  async function analyze() {
    if (!source || !modelId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.predict(serverUrl, modelId, source);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onResult(result, source, models);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      {/* ---------- header ---------- */}
      <LinearGradient colors={gradients.header} style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.page}>
          <View style={styles.headerRow}>
            <View style={styles.logo}>
              <Ionicons name="planet" size={26} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.appName}>Oil Spill Scan</Text>
              <Text style={styles.appSubtitle}>SAR semantic segmentation</Text>
            </View>
            <IconButton icon="settings-outline" onPress={onOpenSettings} />
          </View>
          <Text style={styles.tagline}>
            Find oil spills, look-alikes, ships and land in satellite radar images — pixel by pixel.
          </Text>
          <Pressable onPress={retry}>
            <StatusPill status={status} />
          </Pressable>
        </View>
      </LinearGradient>

      <View style={[styles.page, styles.content]}>
        {/* ---------- 1. model ---------- */}
        <Card>
          <SectionTitle step="1" title="Choose a model" />
          {status === 'online' && models.length === 0 && (
            <Text style={styles.muted}>
              The server has no trained models yet. Train them in the Kaggle notebook and copy unet.pth / deeplab.pth
              into backend/weights.
            </Text>
          )}
          {status !== 'online' && <Text style={styles.muted}>Connect to the server to load the models.</Text>}
          <View style={styles.modelRow}>
            {models.map((m) => {
              const selected = m.id === modelId;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setModelId(m.id)}
                  style={[styles.modelCard, selected && styles.modelCardSelected]}
                >
                  <View style={styles.modelTop}>
                    <Ionicons
                      name={m.architecture === 'unet' ? 'construct-outline' : 'rocket-outline'}
                      size={22}
                      color={selected ? colors.accent : colors.muted}
                    />
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={selected ? colors.accent : colors.border}
                    />
                  </View>
                  <Text style={styles.modelName}>{m.name}</Text>
                  <Text style={styles.modelDetail}>{m.detail}</Text>
                  <View style={styles.metricBadge}>
                    <Text style={styles.metricLabel}>{m.test_miou != null ? 'TEST mIoU' : 'VAL mIoU'}</Text>
                    <Text style={styles.metricText}>{pct(m.test_miou ?? m.val_miou)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* ---------- 2. image ---------- */}
        <Card>
          <SectionTitle step="2" title="Choose a SAR image" />
          <View style={styles.buttonRow}>
            <SecondaryButton label="Gallery" icon="images-outline" onPress={() => pickImage(false)} style={{ flex: 1 }} />
            <SecondaryButton label="Camera" icon="camera-outline" onPress={() => pickImage(true)} style={{ flex: 1 }} />
          </View>

          {samples.length > 0 && (
            <>
              <Text style={[styles.muted, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
                Or try a test image from the dataset:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {samples.map((s) => {
                  const uri = api.sampleUrl(serverUrl, s);
                  const selected = source?.kind === 'sample' && source.name === s.name;
                  return (
                    <Pressable
                      key={s.name}
                      onPress={() => setSource({ kind: 'sample', name: s.name, uri })}
                      style={[styles.thumb, selected && styles.thumbSelected]}
                    >
                      <Image source={{ uri }} style={styles.thumbImage} />
                      {s.has_label && (
                        <View style={styles.gtBadge}>
                          <Text style={styles.gtText}>GT</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          {source && (
            <View style={styles.preview}>
              <Image source={{ uri: source.uri }} style={styles.previewImage} resizeMode="contain" />
              <Text style={styles.previewCaption}>
                {source.kind === 'sample' ? `Test sample · ${source.name}` : 'Your image'}
              </Text>
            </View>
          )}
        </Card>

        {/* ---------- 3. analyze ---------- */}
        <PrimaryButton
          label={loading ? 'Segmenting pixels…' : 'Analyze image'}
          icon="scan-outline"
          onPress={analyze}
          loading={loading}
          disabled={!source || !modelId}
        />
        {!source && status === 'online' && models.length > 0 && (
          <Text style={[styles.muted, { textAlign: 'center' }]}>Pick an image to start.</Text>
        )}
        {error && <ErrorBanner message={error} />}

        {/* ---------- legend ---------- */}
        <Card>
          <SectionTitle icon="color-palette-outline" title="What the colours mean" />
          <Legend />
        </Card>

        <Text style={styles.footer}>
          U-Net (from scratch) vs DeepLabV3+ (ImageNet-pretrained){'\n'}Dataset: Krestenitis et al., Remote Sensing 2019
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accent + '1F',
    borderWidth: 1,
    borderColor: colors.accent + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { color: colors.text, fontSize: 24, fontWeight: '800' },
  appSubtitle: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 2 },
  tagline: { color: colors.muted, fontSize: 15, lineHeight: 22, marginVertical: spacing.md },
  content: { paddingHorizontal: spacing.md, gap: spacing.md, marginTop: -8 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  modelRow: { flexDirection: 'row', gap: 12 },
  modelCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  modelCardSelected: { borderColor: colors.accent, backgroundColor: colors.accent + '0D' },
  modelTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  modelName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  modelDetail: { color: colors.muted, fontSize: 12 },
  metricBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.cardLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  metricText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  thumb: { borderRadius: radius.sm, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  thumbSelected: { borderColor: colors.accent },
  thumbImage: { width: 128, height: 67, backgroundColor: '#000' },
  gtBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  gtText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  preview: { marginTop: spacing.md, gap: 6 },
  previewImage: { width: '100%', height: 190, borderRadius: radius.md, backgroundColor: '#000' },
  previewCaption: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  footer: { color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, opacity: 0.7, marginTop: 8 },
});
