import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Copy, TabId } from "./copy";
import { INK, MUTED, space } from "./theme";
import { Card, SectionTitle } from "./ui";

const TABS: Array<{ id: TabId; icon: string }> = [
  { id: "today", icon: "◉" },
  { id: "trip", icon: "✈" },
  { id: "care", icon: "✚" },
  { id: "hotel", icon: "⌂" },
];

export function AppHeader({
  title,
  color,
  logoUrl,
  linked,
  unread,
  overlay,
  backLabel,
  onBack,
  onAccount,
  onBell,
}: {
  title: string;
  color: string;
  logoUrl?: string | null;
  linked: boolean;
  unread?: boolean;
  overlay?: "none" | "bell" | "account";
  backLabel?: string;
  onBack?: () => void;
  onAccount: () => void;
  onBell: () => void;
}) {
  const insets = useSafeAreaInsets();
  const inOverlay = overlay === "bell" || overlay === "account";
  return (
    <View
      style={{
        paddingHorizontal: space.md,
        paddingTop: Math.max(insets.top, 8) + 4,
        paddingBottom: space.sm,
        backgroundColor: color,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {inOverlay ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.22)",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
              ← {backLabel ?? "Back"}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={onAccount} hitSlop={6}>
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#fff",
                  borderWidth: linked ? 2 : 0,
                  borderColor: "#fff",
                }}
              />
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.25)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                  {linked ? "✓" : "☺"}
                </Text>
              </View>
            )}
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {!inOverlay ? (
          <Pressable onPress={onBell} hitSlop={8} style={{ paddingHorizontal: 4, paddingVertical: 2 }}>
            <View>
              <Text style={{ color: "#fff", fontSize: 22 }}>🔔</Text>
              {unread ? (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#F5C542",
                  }}
                />
              ) : null}
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function TabBar({
  copy,
  tab,
  onChange,
}: {
  copy: Copy;
  tab: TabId;
  onChange: (id: TabId) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-around",
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 10) + 6,
        borderTopWidth: 1,
        borderTopColor: "#E4E0D8",
        backgroundColor: "#FBFaf7",
      }}
    >
      {TABS.map(({ id, icon }) => {
        const active = tab === id;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            style={{ alignItems: "center", minWidth: 64, paddingVertical: 4 }}
          >
            <Text style={{ fontSize: 18, color: active ? INK : MUTED }}>{icon}</Text>
            <Text
              style={{
                color: active ? INK : MUTED,
                fontWeight: active ? "700" : "500",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              {copy.tabs[id]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmergencyCard({
  copy,
  deskPhone,
  doctorPhone,
}: {
  copy: Copy;
  deskPhone?: string | null;
  doctorPhone?: string | null;
}) {
  if (!deskPhone && !doctorPhone) return null;
  return (
    <Card>
      <SectionTitle>{copy.emergencyTitle}</SectionTitle>
      {deskPhone ? (
        <Text style={{ color: INK, marginTop: 4 }}>
          {copy.deskLabel}: {deskPhone}
        </Text>
      ) : null}
      {doctorPhone ? (
        <Text style={{ color: INK, marginTop: 4 }}>
          {copy.doctorLabel}: {doctorPhone}
        </Text>
      ) : null}
    </Card>
  );
}
