import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { CARD, DANGER, INK, LINE, MUTED, space } from "./theme";

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Muted({ children }: { children: string }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <Card>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.muted}>{body}</Text> : null}
    </Card>
  );
}

export function ListRow({
  title,
  subtitle,
  meta,
  unread,
  onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  unread?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, unread ? styles.unread : null]}>{title}</Text>
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      </View>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}

export function PrimaryButton({
  label,
  color,
  onPress,
  disabled,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primary, { backgroundColor: color, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.ghost}>
      <Text style={{ color, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  return <TextInput {...props} placeholderTextColor={MUTED} style={[styles.input, props.style]} />;
}

export function ErrorText({ children }: { children: string }) {
  return <Text style={styles.error}>{children}</Text>;
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipOn : null]}
    >
      <Text style={[styles.chipLabel, active ? styles.chipLabelOn : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    padding: space.md,
    marginBottom: space.sm,
  },
  section: {
    color: INK,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: space.sm,
    marginTop: space.xs,
  },
  muted: { color: MUTED, fontSize: 13, lineHeight: 18, marginTop: 2 },
  emptyTitle: { color: INK, fontWeight: "600", fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  rowTitle: { color: INK, fontSize: 14, fontWeight: "500" },
  unread: { fontWeight: "700" },
  meta: { color: MUTED, fontSize: 12 },
  primary: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    marginTop: space.sm,
  },
  primaryLabel: { color: "#fff", fontWeight: "700", fontSize: 15 },
  ghost: { marginTop: space.sm, paddingVertical: 6 },
  input: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: space.xs,
    color: INK,
    backgroundColor: "#FBFaf7",
  },
  error: { color: DANGER, marginTop: space.xs, fontSize: 13 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FBFaf7",
  },
  chipOn: { backgroundColor: INK, borderColor: INK },
  chipLabel: { color: INK, fontSize: 12, fontWeight: "600" },
  chipLabelOn: { color: "#fff" },
});
