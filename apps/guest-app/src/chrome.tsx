import { Image, Pressable, Text, View } from "react-native";
import type { Copy, TabId } from "./copy";
import { INK, MUTED, space } from "./theme";
import { Card, SectionTitle } from "./ui";

const TABS: TabId[] = ["today", "trip", "care", "hotel"];

export function AppHeader({
  title,
  color,
  logoUrl,
  updatedLabel,
  loadedAt,
  bellLabel,
  onBell,
}: {
  title: string;
  color: string;
  logoUrl?: string | null;
  updatedLabel: string;
  loadedAt: string | null;
  bellLabel: string;
  onBell: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm, backgroundColor: color }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#fff" }} />
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)" }} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }} numberOfLines={1}>
            {title}
          </Text>
          {loadedAt ? (
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2 }}>
              {updatedLabel}: {loadedAt.slice(0, 19).replace("T", " ")}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={onBell} hitSlop={8}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{bellLabel}</Text>
        </Pressable>
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
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-around",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#E4E0D8",
        backgroundColor: "#FBFaf7",
      }}
    >
      {TABS.map((id) => {
        const active = tab === id;
        return (
          <Pressable key={id} onPress={() => onChange(id)} style={{ paddingHorizontal: 8 }}>
            <Text style={{ color: active ? INK : MUTED, fontWeight: active ? "700" : "500", fontSize: 13 }}>
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
