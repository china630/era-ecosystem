import { NativeModules, TurboModuleRegistry } from "react-native";

type KioskNative = {
  isDeviceOwner(): boolean;
  isInKioskMode(): boolean;
  isKioskPaused(): boolean;
  startKiosk(): void;
  stopKiosk(): void;
  resumeKiosk(): void;
  openDesktop(): void;
  openSettings(): void;
  openWifi(): void;
  nativeLog(tag: string, message: string): void;
  installUpdate(url: string): Promise<void>;
};

function native(): KioskNative | null {
  try {
    const turbo = TurboModuleRegistry.get<KioskNative>("Kiosk");
    if (turbo) return turbo;
  } catch {
    // ignore
  }
  const legacy = NativeModules.Kiosk as KioskNative | undefined;
  return legacy ?? null;
}

export function isDeviceOwner(): boolean {
  return native()?.isDeviceOwner?.() ?? false;
}

export function isInKioskMode(): boolean {
  return native()?.isInKioskMode?.() ?? false;
}

export function isKioskPaused(): boolean {
  return native()?.isKioskPaused?.() ?? false;
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

export function resumeKiosk(): void {
  native()?.resumeKiosk();
}

export function openDesktop(): void {
  native()?.openDesktop();
}

export function openSettings(): void {
  native()?.openSettings();
}

export function openWifi(): void {
  native()?.openWifi();
}

export function nativeLog(tag: string, message: string): void {
  try {
    native()?.nativeLog(tag, message);
  } catch {
    console.log(`[${tag}] ${message}`);
  }
}

export async function installUpdate(url: string): Promise<void> {
  const mod = native();
  if (!mod) throw new Error("Kiosk native module is missing");
  await mod.installUpdate(url);
}
