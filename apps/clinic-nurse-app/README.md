# Clinic nurse tablet

Android kiosk for the clinic nurse board. It signs in with the clinic staff login and shows today's procedures for that nurse — the same four columns and the same check-in call as `https://clinic.era-365.online/nurse?mine=1`.

Package: `online.era365.nurse`. Device-admin receiver: `online.era365.nurse.AdminReceiver`.

Landscape only. The board is sized for a 9.5–10.5 inch tablet: four equal columns fill the width and the height under a single header line. Each column scrolls on its own. Time and room sit on one line, the guest name is the large line, and Check-in is a 48dp target.

Expo Go is not used. Build with EAS (`eas build -p android --profile preview`) or `npx expo prebuild --platform android`.

## Config

| Variable | Meaning |
|---|---|
| `EXPO_PUBLIC_CLINIC_URL` | Clinic origin. Default `https://clinic.era-365.online`. |
| `EXPO_PUBLIC_UPDATE_URL` | Folder that serves `version.json` and APK files. Empty skips APK checks. |
| `EXPO_PUBLIC_KIOSK_PIN` | Service PIN. Five taps in the top-right corner, then this PIN, calls `stopKiosk`. Empty PIN never matches. |

`version.json`:

```json
{ "versionCode": 12, "apkUrl": "https://example/app-12.apk" }
```

Every APK must be signed with the same EAS key or Android will refuse the silent install.

## Device owner (one time per tablet)

Factory-reset the tablet and do not add a Google account. Install the APK, then:

```text
adb shell dpm set-device-owner online.era365.nurse/.AdminReceiver
```

After that the app is the home screen, the status bar stays hidden, and APK updates install without a dialog. A reboot opens the app again.

Without device owner the app only pins the screen. The nurse can leave by holding Back, and the app does not start on boot.

## Releases

- Native APK: `eas build -p android --profile preview`, upload the APK, bump `version.json`. The tablet checks on launch and every six hours.
- JavaScript only: `eas update --channel preview` after `eas init` replaces the placeholder project id in `app.json`.

## Tests

```text
npm test
```

Column placement matches `era-clinic/app/nurse/page.tsx`.
