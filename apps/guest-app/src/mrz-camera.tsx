import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { parseGuestMrz, type GuestMrzDocument } from "./mrz-parse";

type Props = {
  color: string;
  onCaptured: (doc: GuestMrzDocument) => void;
  labels: { open: string; close: string; hint: string };
};

/**
 * Native MRZ camera frame (Wave H). Falls back to null UI when camera module unavailable (Expo Go web).
 */
export function MrzCameraFrame({ color, onCaptured, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [CameraView, setCameraView] = useState<null | ((props: {
    style: object;
    facing: string;
    onBarcodeScanned?: (e: { data: string }) => void;
  }) => JSX.Element)>(null);
  const [perm, setPerm] = useState<"undetermined" | "granted" | "denied">("undetermined");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cam = await import("expo-camera");
        if (cancelled) return;
        setCameraView(() => cam.CameraView as never);
        const { status } = await cam.Camera.requestCameraPermissionsAsync();
        if (!cancelled) setPerm(status === "granted" ? "granted" : "denied");
      } catch {
        if (!cancelled) setPerm("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={{ marginTop: 8 }}>
        <Text style={{ color }}>{labels.open}</Text>
      </Pressable>
    );
  }

  if (!CameraView || perm !== "granted") {
    return (
      <View style={{ marginTop: 8 }}>
        <Text>{labels.hint}</Text>
        <Pressable onPress={() => setOpen(false)}>
          <Text style={{ color }}>{labels.close}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 8, height: 180, borderWidth: 3, borderColor: "#c0392b" }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={({ data }) => {
          const doc = parseGuestMrz(data);
          if (doc?.checksOk) {
            onCaptured(doc);
            setOpen(false);
          }
        }}
      />
      <Pressable onPress={() => setOpen(false)} style={{ padding: 6, backgroundColor: "#fff" }}>
        <Text style={{ color }}>{labels.close}</Text>
      </Pressable>
    </View>
  );
}
