# Clinic nurse tablet

Android kiosk for the clinic nurse board. It signs in with the clinic staff login and shows today's procedures for that nurse — the same four columns and the same check-in call as `https://clinic.era-365.online/nurse?mine=1`.

Package: `online.era365.nurse`. Device-admin receiver: `online.era365.nurse.AdminReceiver`.

Landscape only. The board is sized for a 9.5–10.5 inch tablet: four equal columns fill the width and the height under a single header line. Each column scrolls on its own. Time and room sit on one line, the guest name is the large line, and Check-in is a 48dp target.

Expo Go is not used. Build with EAS (`eas build -p android --profile preview`) or `npx expo prebuild --platform android`.

## Config

| Variable | Meaning |
|---|---|
| `EXPO_PUBLIC_CLINIC_URL` | Clinic origin. Default `https://clinic.era-365.online`. |
| `EXPO_PUBLIC_UPDATE_URL` | Folder that serves `version.json` and APK files. Default `https://app.era-365.online/tablet-apps/nurse`. |
| `EXPO_PUBLIC_KIOSK_PIN` | Service PIN. Five taps in the top-right corner, then this PIN, calls `stopKiosk`. Default `0000` when unset. |

`version.json`:

```json
{ "versionCode": 12, "apkUrl": "https://app.era-365.online/tablet-apps/nurse/Clinic-Nurse-12.apk" }
```

The release file name is `Clinic-Nurse-release.apk` (`base.archivesName` in the Android gradle file, applied by `plugins/withKiosk.js` on prebuild). Upload that file (or a copy named in `apkUrl`) next to `version.json`. Org id is not part of the URL: one nurse APK serves every clinic.

Every APK must be signed with the same EAS key or Android will refuse the silent install.

## Device owner (one time per tablet)

Factory-reset the tablet and do not add a Google account. Install the APK, then:

```text
adb shell dpm set-device-owner online.era365.nurse/.AdminReceiver
```

After that the app is the home screen, the status bar stays hidden, and APK updates install without a dialog. A reboot opens the app again.

Silent update relaunch: after `PackageInstaller` replaces the APK the process is killed (full install). Before commit, `online.era365.nurse.cover` covers the screen. `InstallResultReceiver`, `MY_PACKAGE_REPLACED`, and exact alarms at 3s/10s bring `MainActivity` back with `NEW_TASK|CLEAR_TASK|CLEAR_TOP`, then lock task + HOME preferred activity are applied again. The download lives only under `filesDir/updates/update.apk` and is deleted when install finishes (success or failure).

PIN exit (`0000`): sets `kioskPausedByAdmin`, stops lock task, clears persistent HOME, opens the system launcher. Resume only via «Return to kiosk» or reboot — not on plain `onResume`.

Without device owner the app only pins the screen. The nurse can leave by holding Back, and the app does not start on boot.

## Releases

- Native APK: `eas build -p android --profile preview` (or `gradlew assembleRelease` after prebuild). Copy the APK into `era-orchestrator/apps/web/tablet-apps/nurse/` on the server and bump `version.json`. The tablet checks on launch and every six hours.
- JavaScript only: `eas update --channel preview` after `eas init` replaces the placeholder project id in `app.json`.

## Tests

```text
npm test
```

Column placement matches `era-clinic/app/nurse/page.tsx`.
