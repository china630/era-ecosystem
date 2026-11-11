# Guest app UAT-SMOKE evidence path

**Status:** template open — statuses stay **yellow / API / SCREEN** until a signed guest-device pass is attached below.

Do not flip SHIPPED / SHOW / Pilot / edition `ga` in the same change as filling blanks without signed evidence.

## Preconditions

- Orch Guest app brand enabled for the org
- Hotel Nest up; desk user can open reservation Guests
- Optional: clinic Nest + `CLINIC_INTERNAL_URL` + shared `SATELLITE_EVENT_SERVICE_TOKEN`
- Device or simulator with `apps/guest-app` (EAS build preferred over Expo Go for camera / biometrics / notifications)

## Checklist

| # | Step | Expected | Evidence (date / device / initials) |
|---|------|----------|-------------------------------------|
| 1 | Desk issues guest link / QR; phone exchanges code | Trip pack on device; offline reload shows trip | |
| 2 | Airplane mode: trip + Care cache + catalog stamp visible | Stale `loadedAt` shown; no invent | |
| 3 | Questionnaire + MRZ (paste and/or camera) | Red/green frame; fields fill; save OK | |
| 4 | Booking request from phone | Appears on `/fo/guest-requests`; staff answer | |
| 5 | Stay order online + offline queue flush | Offline stays `QUEUED` until flush; never shown as hotel-accepted early | |
| 6 | Care timetable/results/episodes (if clinic linked) | Honest `reason` when empty; published results only | |
| 7 | Family grant + desk confirm | Grantee timetable only; results denied | |
| 8 | Phone OTP SMS→WA→email order | SMS/WA STUB until vendor UAT; email non-OTA | |
| 9 | Bell inbox + marketing mute | Marketing hidden; clinic/reception still visible | |
| 10 | Folio + board + emergency phones | Own folio lines; meal plan; desk/doctor from brand | |
| 11 | Orch live phone preview | Form color/name/logo/locale update preview without Save | |
| 12 | Lead local notification (device) | Schedules from Care; quiet hours unless alarm mode | |
| 13 | Biometrics unlock cached trip | Session token present; no staff password | |

## Sign-off

- Tester:
- Date:
- Build / commit:
- Result: PASS / FAIL
- Notes:

After PASS, a **separate** PR may promote COVERAGE to SHIPPED / Product-Readiness SHOW / Pilot per edition rules.
