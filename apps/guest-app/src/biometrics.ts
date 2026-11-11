/**
 * Unlock offline trip pack when a session token is already present (ADR §5).
 * No staff password — device biometrics / PIN only.
 */
export async function unlockCachedTripWithBiometrics(): Promise<boolean> {
  try {
    const LocalAuthentication = await import("expo-local-authentication");
    const has = await LocalAuthentication.hasHardwareAsync();
    if (!has) return true;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return true;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock your trip",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return result.success === true;
  } catch {
    // Expo Go / web without native module — allow cached trip (dev).
    return true;
  }
}
