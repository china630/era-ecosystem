# Guest app — white-label store ops runbook

**Status:** ops checklist only. Does **not** claim edition `ga`, Pilot-ready, or SHIPPED. Store binary upload is outside product AC until signed guest-device UAT (Wave J).

Canon: [guest-stay-app.md](../adr/guest-stay-app.md). Phone app: `apps/guest-app`. Brand SSOT: orchestrator `OrganizationGuestApp` (not letterhead).

## Per-hotel bake

1. Set EAS / CI env for the slot:
   - `EXPO_PUBLIC_ORGANIZATION_ID`
   - `EXPO_PUBLIC_ORCH_URL`
   - `EXPO_PUBLIC_HOTEL_URL` (guest Nest, e.g. `…:13201`)
2. Bundle id / package (defaults in `app.json`):
   - iOS `online.era365.guest` → replace with hotel slot if Apple agreement requires uniqueness
   - Android `online.era365.guest`
3. Icons / splash: replace Expo defaults before store submit (owner brand assets; not org letterhead unless owner chooses).
4. Push certs (APNs / FCM): required for remote procedure-move push. Until present, push stays **STUB** in COVERAGE.
5. Profiles: `apps/guest-app/eas.json` → `preview` / `production`.

## Store account agreement

- [ ] Apple Developer / Google Play org account for the hotel (or ERA agency agreement)
- [ ] Privacy policy URL covering published lab results only (no draft / clinical chart dump)
- [ ] Data safety form: trip pack + Care timetable/results offline cache (text only; no clinic archive blobs)
- [ ] Age rating / medical disclaimer language as required by store

## Privacy bounds (product)

- Published results only (portal semantics via clinic guest-care).
- Family grant: timetable only after desk confirm; results never via grant.
- Marketing mute does not mute CLINIC / RECEPTION inbox rows.
- Identity remains MDM (`globalPersonId`); phone app does not become an identity SoR.

## Owner handoff (orchestrator)

Workspace → Organization → Guest app: name, color, logo URL, locale, desk / doctor phones, catalog / offers JSON, lead alert minutes. Live phone preview updates from form state before Save (CP-GUEST-APP-03). Optional store listing notes may be kept outside product AC (ticket / ops wiki).

## Do not

- Flip `hotel.yaml` / `platform.yaml` to `ga` from this runbook.
- Claim SHIPPED / SHOW / sell without signed `reports/guest-app-uat-smoke.md`.
