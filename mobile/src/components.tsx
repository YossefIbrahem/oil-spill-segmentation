// Small reusable UI pieces used by the screens.
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { CLASSES, colors, gradients, radius, spacing } from './theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ step, title, icon }: { step?: string; title: string; icon?: IconName }) {
  return (
    <View style={styles.sectionRow}>
      {step ? (
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ) : icon ? (
        <Ionicons name={icon} size={18} color={colors.accent} />
      ) : null}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export function PrimaryButton(props: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = props.disabled || props.loading;
  return (
    <Pressable onPress={props.onPress} disabled={inactive} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <LinearGradient
        colors={inactive ? (['#1E3A5F', '#1E3A5F'] as const) : gradients.button}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButton}
      >
        {props.loading ? (
          <ActivityIndicator color="#04202B" />
        ) : (
          props.icon && <Ionicons name={props.icon} size={20} color={inactive ? colors.muted : '#04202B'} />
        )}
        <Text style={[styles.primaryLabel, inactive && { color: colors.muted }]}>{props.label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function SecondaryButton(props: { label: string; icon: IconName; onPress: () => void; style?: ViewStyle }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [styles.secondaryButton, props.style, pressed && { backgroundColor: colors.cardLight }]}
    >
      <Ionicons name={props.icon} size={20} color={colors.accent} />
      <Text style={styles.secondaryLabel}>{props.label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress }: { icon: IconName; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

// Coloured dot for a class. Sea (black) gets an outline so it is visible on the dark background.
export function ClassDot({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: color === '#000000' ? 1.5 : 0,
        borderColor: 'rgba(255,255,255,0.5)',
      }}
    />
  );
}

export function Legend() {
  return (
    <View style={styles.legend}>
      {CLASSES.map((c) => (
        <View key={c.id} style={styles.legendItem}>
          <ClassDot color={c.color} />
          <Text style={styles.legendText}>{c.name}</Text>
        </View>
      ))}
    </View>
  );
}

export function StatusPill({ status }: { status: 'checking' | 'online' | 'offline' }) {
  const color = status === 'online' ? colors.success : status === 'offline' ? colors.danger : colors.warning;
  const label = status === 'online' ? 'Server online' : status === 'offline' ? 'Server offline' : 'Connecting…';
  return (
    <View style={[styles.pill, { borderColor: color + '66' }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle" size={20} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

// A small "label / value" box, e.g. "Inference · 230 ms"
export function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Two or more options side by side, one selected (e.g. Overlay / Mask / Original)
export function Segmented<T extends string>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {props.options.map((o) => {
        const active = o.value === props.value;
        return (
          <Pressable key={o.value} onPress={() => props.onChange(o.value)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.accent, fontWeight: '800', fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  primaryButton: {
    height: 56,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryLabel: { color: '#04202B', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  secondaryButton: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent + '55',
    backgroundColor: colors.accent + '10',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { color: colors.muted, fontSize: 13 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  errorBanner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.danger + '1A',
    borderColor: colors.danger + '55',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  errorText: { color: '#FECACA', flex: 1, fontSize: 14, lineHeight: 20 },
  stat: {
    flex: 1,
    backgroundColor: colors.cardLight,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'flex-start',
    gap: 4,
  },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 12 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.cardLight },
  segmentText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  segmentTextActive: { color: colors.accent },
});
