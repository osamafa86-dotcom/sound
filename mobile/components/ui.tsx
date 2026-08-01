import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "../lib/theme";

/** غلاف شاشة موحّد: خلفية ورقية وتمرير وحواف آمنة */
export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: PropsWithChildren) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Chip({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
      {hint ? (
        <Text style={[styles.chipHint, selected && styles.chipHintSelected]}>{hint}</Text>
      ) : null}
    </Pressable>
  );
}

export function ChipRow({ children }: PropsWithChildren) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={[styles.button, inactive && styles.buttonDisabled]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      {...props}
      style={[styles.field, props.multiline && styles.fieldMultiline, props.style]}
    />
  );
}

export function ErrorText({ children }: PropsWithChildren) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function MutedText({ children }: PropsWithChildren) {
  return <Text style={styles.mutedText}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.body,
    textAlign: "right",
    writingDirection: "rtl",
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.body,
    textAlign: "right",
    writingDirection: "rtl",
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 16,
    gap: 12,
  },
  chipRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryStrong,
  },
  chipLabel: { color: colors.body, fontSize: 14, fontWeight: "600" },
  chipLabelSelected: { color: "#fff" },
  chipHint: { color: colors.muted, fontSize: 11, marginTop: 2 },
  chipHintSelected: { color: colors.rose },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonLabel: { color: "#fff", fontSize: 16, fontWeight: "700" },
  field: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    color: colors.body,
    textAlign: "right",
    writingDirection: "rtl",
  },
  fieldMultiline: { minHeight: 120, textAlignVertical: "top" },
  error: {
    color: colors.primaryStrong,
    backgroundColor: colors.rose,
    borderRadius: radius.sm,
    padding: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 20,
  },
});
