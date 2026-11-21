// Result: segmentation image, oil alert, class breakdown and (for test samples) accuracy vs ground truth.
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ImageSource, ModelInfo, pct, PredictResult } from '../api';
import {
  Card,
  ClassDot,
  ErrorBanner,
  IconButton,
  Legend,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  Segmented,
  Stat,
} from '../components';
import { CLASSES, colors, gradients, radius, spacing } from '../theme';

type ViewMode = 'overlay' | 'mask' | 'image' | 'gt';

type Props = {
  result: PredictResult;
  source: ImageSource;
  models: ModelInfo[];
  serverUrl: string;
  onBack: () => void;
  onNewResult: (result: PredictResult) => void;
};

export default function ResultScreen({ result, source, models, serverUrl, onBack, onNewResult }: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ViewMode>('overlay');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherModel = models.find((m) => m.id !== result.model.id);
  const gt = result.ground_truth;

  const imageFor: Record<ViewMode, string> = {
    overlay: result.overlay,
    mask: result.mask,
    image: result.image,
    gt: gt?.mask ?? result.mask,
  };
  const viewOptions: { value: ViewMode; label: string }[] = [
    { value: 'overlay', label: 'Overlay' },
    { value: 'mask', label: 'Mask' },
    { value: 'image', label: 'Original' },
    ...(gt ? [{ value: 'gt' as ViewMode, label: 'Truth' }] : []),
  ];

  async function runOtherModel() {
    if (!otherModel) return;
    setLoading(true);
    setError(null);
    try {
      onNewResult(await api.predict(serverUrl, otherModel.id, source));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <View style={[styles.page, { paddingTop: insets.top + 12, paddingHorizontal: spacing.md, gap: spacing.md }]}>
        {/* ---------- top bar ---------- */}
        <View style={styles.topBar}>
          <IconButton icon="arrow-back" onPress={onBack} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Analysis result</Text>
            <Text style={styles.subtitle}>
              {result.model.name} · {result.model.detail}
            </Text>
          </View>
        </View>

        {/* ---------- oil alert ---------- */}
        <LinearGradient
          colors={result.oil_detected ? gradients.danger : gradients.success}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.alert}
        >
          <View style={styles.alertIcon}>
            <Ionicons name={result.oil_detected ? 'warning' : 'checkmark-circle'} size={30} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>{result.oil_detected ? 'Oil spill detected' : 'No oil spill detected'}</Text>
            <Text style={styles.alertText}>
              {result.oil_detected
                ? `${result.oil_percent.toFixed(2)}% of the scene · model confidence ${pct(result.oil_confidence, 0)}`
                : `Less than 0.1% of the pixels were classified as oil (${result.oil_percent.toFixed(2)}%).`}
            </Text>
          </View>
        </LinearGradient>

        {/* ---------- image viewer ---------- */}
        <Card style={{ padding: 12, gap: 12 }}>
          <Segmented options={viewOptions} value={view} onChange={setView} />
          <Image
            source={{ uri: imageFor[view] }}
            style={[styles.image, { aspectRatio: result.width / result.height }]}
            resizeMode="contain"
          />
          <Legend />
        </Card>

        {/* ---------- quick stats ---------- */}
        <View style={styles.statRow}>
          <Stat icon="speedometer-outline" label="Inference" value={`${Math.round(result.inference_ms)} ms`} />
          <Stat icon="resize-outline" label="Image size" value={`${result.width}×${result.height}`} />
          <Stat icon="pulse-outline" label="Avg confidence" value={pct(result.mean_confidence, 0)} />
        </View>

        {/* ---------- class breakdown ---------- */}
        <Card>
          <SectionTitle icon="analytics-outline" title="Class breakdown" />
          {result.classes.map((c) => (
            <View key={c.id} style={styles.classRow}>
              <View style={styles.classHeader}>
                <ClassDot color={CLASSES[c.id].color} />
                <Text style={styles.className}>{c.name}</Text>
                <Text style={styles.classPercent}>{c.percent < 0.01 && c.percent > 0 ? '<0.01' : c.percent.toFixed(2)}%</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.max(c.percent, c.pixels > 0 ? 1 : 0)}%`,
                      backgroundColor: c.id === 0 ? '#475569' : CLASSES[c.id].color,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </Card>

        {/* ---------- ground truth comparison (test samples only) ---------- */}
        {gt && (
          <Card>
            <SectionTitle icon="ribbon-outline" title="Compared with the ground truth" />
            <View style={styles.statRow}>
              <Stat icon="layers-outline" label="Image mIoU" value={pct(gt.miou)} />
              <Stat icon="checkmark-done-outline" label="Pixel accuracy" value={pct(gt.pixel_acc)} />
            </View>
            <View style={styles.iouGrid}>
              {CLASSES.map((c) => (
                <View key={c.id} style={styles.iouChip}>
                  <ClassDot color={c.color} size={10} />
                  <Text style={styles.iouText}>
                    {c.name}: {gt.iou[c.id] == null ? 'not present' : pct(gt.iou[c.id])}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* ---------- model info ---------- */}
        <Card>
          <SectionTitle icon="school-outline" title="About this model" />
          <InfoRow label="Experiment" value={result.model.experiment} />
          <InfoRow label="Best epoch (by validation mIoU)" value={String(result.model.best_epoch)} />
          <InfoRow label="Validation mIoU" value={pct(result.model.val_miou)} />
          <InfoRow label="Test-set mIoU" value={pct(result.model.test_miou)} />
          <InfoRow label="Model input size" value={result.model.input_size.join(' × ')} />
        </Card>

        {error && <ErrorBanner message={error} />}
        {otherModel && (
          <SecondaryButton
            label={loading ? 'Running…' : `Compare with ${otherModel.name}`}
            icon="git-compare-outline"
            onPress={runOtherModel}
          />
        )}
        <PrimaryButton label="New analysis" icon="add-circle-outline" onPress={onBack} />
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  alert: { borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 14 },
  alertIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  alertText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 3, lineHeight: 20 },
  image: { width: '100%', borderRadius: radius.sm, backgroundColor: '#000' },
  statRow: { flexDirection: 'row', gap: 10 },
  classRow: { marginBottom: 12 },
  classHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  className: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  classPercent: { color: colors.text, fontSize: 15, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.background, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  iouGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  iouChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  iouText: { color: colors.text, fontSize: 13 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  infoLabel: { color: colors.muted, fontSize: 14, flexShrink: 1 },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
