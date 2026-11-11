import { requireNativeModule } from "expo-modules-core";

type KioskNative = {
  isDeviceOwner(): boolean;
  isInKioskMode(): boolean;
  startKiosk(): void;
  stopKiosk(): void;
  installUpdate(url: string): Promise<void>;
};

function native(): KioskNative | null {
  try {
    return requireNativeModule<KioskNative>("Kiosk");
  } catch {
    return null;
  }
}

export function isDeviceOwner(): boolean {
  return native()?.isDeviceOwner() ?? false;
}

export function isInKioskMode(): boolean {
  return native()?.isInKioskMode() ?? false;
}

export function startKiosk(): void {
  const mod = native();
  if (!mod) {
    console.warn("Kiosk native module is missing. Build with expo prebuild / EAS, not Expo Go.");
    return;
  }
  mod.startKiosk();
}

export function stopKiosk(): void {
  native()?.stopKiosk();
}

export async function installUpdate(url: string): Promise<void> {
  const mod = native();
  if (!mod) throw new Error("Kiosk native module is missing");
  await mod.installUpdate(url);
}
