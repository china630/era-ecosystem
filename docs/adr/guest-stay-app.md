# ADR: Guest stay app (hotel + sanatorium, white-label)

**Status:** Accepted — product decision, **not implemented**. No COVERAGE row, Scaffold, Product Readiness, or edition sell claim until a delivery wave lands.  
**Date:** 2026-11-11  
**Related:** [hotel-guest-pii-ops-cache.md](./hotel-guest-pii-ops-cache.md) · [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md) · [hotel-reservation-card-and-party-ops.md](./hotel-reservation-card-and-party-ops.md) · [nafta-episode-per-pax.md](./nafta-episode-per-pax.md) · [clinic-episode-as-clinical-course.md](./clinic-episode-as-clinical-course.md) · [clinic-guest-blank-after-payment.md](./clinic-guest-blank-after-payment.md) · [cp-organization-profile-and-branding.md](./cp-organization-profile-and-branding.md) · [org-public-number-and-login-host.md](./org-public-number-and-login-host.md) · [hotel-clinic-lifecycle-outbox.md](./hotel-clinic-lifecycle-outbox.md)

## Context

Nafta-style properties sell one stay that is both a hotel room and a treatment course. The guest is a foreign tourist as often as a local. Reception types identity by hand before check-in can proceed. The guest cannot see the transfer, who is meeting them, the treatment timetable, their episodes, or published results on their own phone. Inbound SMS often fails in roaming, so a code to a foreign number cannot be the only door. At the border and in the taxi there is often no data at all, so the trip has to already be on the device. After departure the hotel still needs a channel for messages and offers, and a returning guest who replaced the phone must get back into the same account.

Staff surfaces stay in `era-hotel-pms` and `era-clinic`. This ADR adds a **guest** client. It is not a second staff UI and not one ERA-branded app that switches organizations.

Identity stays in MDM (`globalPersonId`). The hotel keeps the operational guest cache. The clinic keeps one episode per person on the stay. The app shows those facts and submits intake. It does not become a store of record for FIN, passport, or the chart.

Screen layout is a later UX pass. This ADR records the behavior agreed for that pass.

## Decision

### 1. Stack and white-label

The client is **Expo (React Native)** on TypeScript, one project, store builds for iOS and Android. Expo is the React Native toolchain (camera, push, local notifications, local store, EAS build), not a third platform. Flutter can do the same job and is rejected here because the rest of ERA is TypeScript. A Dart app would be a separate craft beside the hotel and the clinic. The choice is Expo.

White-label is a **separate store listing per organization**. There is no tenant switcher.

- The owner customizes the brand in the orchestrator: app name, icon, colors, default language, contacts, consent and store texts, hotel information copy, API base.
- ERA builds that brand and **uploads the already customized binary** to App Store and Play. Code and updates stay with ERA. The listing brand is the hotel’s.
- The store account is agreed per hotel: the hotel’s developer account, or ERA publishes under a written agreement. Push certificates and bundle id belong to that listing, because it is a different app.
- The binary talks only to that tenant. The guest cannot change organization.
- Staff login hosts and `platform_domain` are a different product. This app does not reuse the reception login form.
- Store review treats health data and privacy text as part of the listing. Clinical claims in the store text stay inside what the app actually shows (published results and a timetable, not a diagnostic device).

Languages in the first build: Azerbaijani, Russian, English.

A guest HTTP API sits in front of hotel and clinic. Staff sessions do not call it. The app does not call staff routes. No new clinical or ledger database is introduced for the phone.

### 2. Shape of the product

The guest gets hotel stay, sanatorium care, and hotel information in one app. Those three are not three products dumped in one menu.

Home is **Today**. Its contents follow the phase:

| Phase | Today shows |
|-------|-------------|
| Before arrival | Booking, transfer and who meets them, package, what to bring, questionnaire |
| In house | Room, next procedure, housekeeping and other room requests, folio, messages |
| After departure | Course summary, recommendations, and the hotel’s offers |

**Hotel information** (packages, prices, holidays, season, and whatever else the property wants the guest to know, receive, or order) is its own place. During the stay it is a second layer, not a block on the clinical cabinet and not beside lab rows. After departure, Today itself becomes that layer, so the hotel can send offers and messages and the guest can ask to come back. Marketing can be muted without muting the clinic.

**Booking v1 is a request**, not a live sale of a door. The guest sends “I want to come” with dates, party, and package (stay, or stay plus treatment). The hotel answers on the existing reservation card. The guest sees the request and the hotel’s reply: requested, confirmed, awaiting payment, cancelled, and the bookings already on the account. A transfer attaches only to a **confirmed** booking: flight or train, time, how many people, child seat, who meets them, vehicle, driver phone. Selling a specific room and rate from the phone waits until rate and availability rules exist. The guest still sees bookings the hotel already holds.

**Stay services the guest orders:**

- Housekeeping: now, later, or not today.
- Do not disturb, towels, water, minibar, wake-up, and other guest services the hotel turns on.
- Each order has a status. An order is not a chat with no owner.
- Arrival time, so the desk and the driver know.
- Late checkout as a request, not as a self-granted extension.
- Key: the app says the key is collected at the desk. Encoding a door lock is out of this decision.

Charges land on the guest folio, or “pay now” when the hotel posts that choice. The guest sees their own lines (room, treatment outside the package, minibar, transfer) and what is already settled. Diagnosis text is not a folio label.

**Board:** today’s meal plan and what is already used, when the package counts covers. Restaurant and in-room food sit with the stay, not with the clinic.

**Messages:** one inbox from the hotel. Reception, the clinic (“be ready, your procedure is soon”), and marketing after they leave. Service and clinical messages stay distinct from offers.

**Departure day:** one question about the stay and one about treatment, while the guest is still in the house. A store-review prompt is separate and later.

**Emergency:** reception and the doctor on duty. That tap is not written into the marketing funnel.

**After the course:** a short guest-facing summary, a reminder for follow-up tests, and the next season. Past stays remain on the account (see §3).

Digital door keys, tips, a points programme, and card acquiring are out of this decision.

### 3. Sanatorium cabinet

What happened clinically is this person’s episodes, not the room number.

On the open course:

- The **whole** timetable, not only the next row: date, time, procedure, room, status (expected, due, done, moved, cancelled). Today is large. The other days of the stay follow.
- The guest does not edit prescriptions. The doctor or the desk moves a row, and the timetable updates.
- Published analyses and conclusions for this course. Draft notes, a diagnosis still being written, and another person’s episode are not on the device.
- What is released still follows the clinic’s payment and publish rules. The app does not invent a second release path.

A returning guest sees **their** past episodes on this tenant: each course, the procedures that belonged to it, and the analyses that were published. That history is why sign-in by the phone number on file must keep working after the handset is replaced (§5). Another guest’s chart is never in that list.

Alerts are per person, including a family member whose timetable this phone is allowed to show (§4):

- A lead alert in the **5–10 minute** window: procedure name, room, “please be ready”. The hotel picks the default inside that window. The guest can turn the alert off.
- At the start time, if the guest is not marked arrived.
- Immediately when the time or the room changes.
- Quiet at night, except an alarm the guest explicitly enabled.

Two channels, one control:

- **Alarm mode** is a local notification scheduled from the timetable already stored for today and tomorrow. It rings with no network. This is the path that works in a sanatorium basement.
- **Server push** carries moves and “we are waiting”. It needs a network.

The control is: off, lead alert (5–10 minutes), or lead alert plus alarm.

### 4. Party, family, children

One booking often holds two adults. The hotel party is already one row per person. The clinic already opens one episode per person. The app follows that. The shared object is the **trip**, not the chart.

**Visible to any adult linked to the booking, and to a phone that holds a family grant for this stay:**

- Dates, room, stay package, meals.
- Transfer and arrival time.
- Room-request status.
- Trip folio totals, without diagnosis text on a line.
- The other adult’s procedure timetable: time, room, procedure name, so one person can walk the other there on time.

**Only that person’s own session:**

- Analyses, conclusions, complaints, diagnoses.
- Passport, FIN, phone, and date of birth in full.

When only one spouse has a phone: that phone has two trip cabinets, “Me” and the other adult. He links his own device with his own desk code. He does not sign in as her. He marks the other adult on **this** booking as family. Her cabinet on his phone shows her timetable, and he can turn her reminders on for this device. Her results stay closed until she signs in herself and opens them for this stay. She can leave the grant in place or close it. The grant is per stay and revocable at any time. Reception sees the grant on the guest row and confirms it when the surname or the party does not match. A person on a different booking cannot be attached.

When she later has her own phone, she signs in as herself. Her cabinet already exists. His family grant can stay or be closed.

A child under 18 has no separate login. The parent sees the child’s timetable and only what the clinic has explicitly released to the parent, not the whole chart.

### 5. Sign-in

The account is the **person on the booking** (the guest row, then `globalPersonId` once identity is linked). It is not the handset, not a staff password, and not the room number.

**At the desk — primary while the guest is in the country and SMS does not arrive.** Each guest row has “Link phone”. The reception monitor shows a QR **for that guest** and a 6-digit code, in case the camera cannot read the screen. Both live about two minutes and die after one success. A new tap mints a new pair. Yesterday’s photo of the monitor does nothing. The app stores a device session. After that, biometrics open the cached trip with no network. The desk shows that a device is linked. Reception or the guest revokes it. One primary device per guest, so a code does not stay alive on three phones unnoticed. A lost phone is one revoke and one new QR. The old session dies.

**The phone number on the profile is a permanent key.** A guest who already stayed and was treated must be able to open the account with that number even after they replace the phone. They install the app again, enter the same number, receive a code, and the new device links. The old device loses the session. History of stays, courses, published analyses, and hotel offers open without the desk and without a QR. QR remains the path when a code to that number does not arrive (typical in roaming at the property).

Channels on that same screen, in order: SMS first. If nothing arrives within a minute, WhatsApp to the same number (delivery abroad is better, and the hotel already uses it). A button sends the same short-lived code to the email on the profile when that inbox is one the guest reads. An OTA relay address (a Booking.com alias and the like) is not treated as that inbox. At home, one of the three usually arrives. At the property, the desk QR is enough.

**Before arrival, without the desk.** The guest installs the app from the hotel’s link and enters confirmation number, surname, and arrival date. That opens the questionnaire, dates, package, and transfer. Timetable, analyses, and the document image stay closed until reception confirms the device or the guest scans the desk QR. A confirmation number is often forwarded to family and to an agent, so it is not full access.

**A new number** does not attach itself to the old course. Recovery is the email on the profile, or the next visit: the desk QR binds the new device and writes the new number onto the profile. Someone else’s number cannot claim the history by typing it.

### 6. Offline trip pack

The phone keeps a local copy. Screens read the copy. The server only refreshes it. This is mandatory: a tourist flying into Azerbaijan often has no roaming and must still open the transfer, see who is waiting, and show a third person that this hotel is expecting them.

Anything that must work in airplane mode is downloaded while a network still exists (home, airport, or hotel Wi-Fi):

- Booking: dates, hotel, address, desk phone, confirmation, party.
- Transfer: who meets them, vehicle, time, place, driver phone.
- A “we are coming here” card that opens with no network and can be shown.
- The questionnaire already filled.
- The procedure timetable for today and tomorrow, because the alarm is local.
- The last folio and the published results already received.
- Hotel information already loaded (packages, prices, holidays, season) so it can be re-read offline. It is still not mixed into the clinical cabinet.

An order placed with no network sits in an outbound queue. The guest sees that it will send when a network appears. It is not shown as accepted by the hotel.

The other adult’s analyses are not written into this cache. The family cache is the shared stay plus that person’s timetable.

The screen shows the last successful load (“updated yesterday at 18:40”). A transfer older than that stamp is visibly stale, not presented as live. The next Wi-Fi (hotel or any network) refreshes the pack on its own.

The pack stays small because the payload is digital text and a few blanks, not a clinic archive and not a second copy of MDM. Hotel, clinic, and MDM remain the source of record. Document numbers collected on the phone are transient intake, then `globalPersonId`, as in [hotel-guest-pii-ops-cache.md](./hotel-guest-pii-ops-cache.md).

### 7. Questionnaire before check-in

The point of the questionnaire is to take primary identity entry off the reception keyboard.

Hotel check-in already refuses the stay until every named guest (primary and companions, not departed, not an empty slot) has sex, a birth date, citizenship, and a document: FIN or passport for an AZ citizen, passport otherwise. An AZ guest aged 18 or older also needs a phone. Under 18 the phone is waived. Given name and surname are required earlier, when the guest card is saved. Patronymic, sex, birth date, citizenship, phone, FIN, and passport may be empty at booking time. That is the gap the app fills.

After the booking is confirmed, the guest completes each party row on the phone:

- Surname, given name, patronymic, sex, date of birth, citizenship.
- Phone.
- Document: FIN or passport, including by MRZ (§8). A photo of the data page is kept when the hotel asks for it, so the desk compares instead of typing.
- Address and an emergency contact when the hotel prints them on the registration card.
- Allergies and how to address the guest. Those are guest-card facts, not a diagnosis.

Reception opens the booking and sees either “questionnaire complete, can check in” or the list of what is still missing. Looking at the document remains. The app does not replace that check. The registration-card signature can still be taken once at the desk, when the fields are already in the system.

The guest can correct the questionnaire until check-in. After check-in, a document change goes through reception, so the open episode and the folio do not diverge from the passport.

### 8. MRZ capture (guest app and hotel UI)

The guest should succeed on one hold of the camera. The same rule applies on the hotel reception UI, so a bad read is obvious to staff and is not typed in as if it had worked.

The camera shows a live frame around the machine-readable zone. There is no shutter button.

- While the light falls badly, the page glares, the lines are cut, the characters are not all read, or the check digits do not match, the frame stays **red**. The frame says which of those it is, in short: low light, glare, lines not fully in frame, check digits failed, or “cannot read / data not read”.
- A red frame writes nothing. A partial OCR result never reaches the form.
- The frame turns **green** only when the MRZ for that document is fully read and the check digits match. At that moment the client takes the still and extracts the MRZ. The guest and the receptionist do not press “capture”.
- A later green frame does not overwrite the fields already taken from the first green frame.

Passport MRZ (two lines) fills surname, given names, sex, date of birth, nationality, passport number, and expiry. An identity card with three MRZ lines uses those three lines and the same red-until-valid rule. The person can correct a single character after the capture if one glyph was still wrong. They are not asked to photograph again when the frame was green.

A foreign passport satisfies the check-in document rule. An Azerbaijani FIN is not inside the travel-passport MRZ. FIN stays its own field: typed, or read from a local identity card when that card’s MRZ actually carries the personal number. A child row is never filled from another person’s document.

Parsing and the check digits run on the device, so a red frame does not need a network. The shipping runtime is the EAS white-label build with the camera native module. Expo Go is not that runtime.

The still, when the hotel keeps it, is an operational scan for the desk to compare. It is not a second identity register.

### 9. Navigation

The app grows inside a fixed construction. Empty sections stay visibly empty until their cycle. Owners do not rearrange it.

Four places, plus a bell. The bell is not a fifth tab.

| Place | Role |
|-------|------|
| **Today** | Home. Contents follow the phase: before arrival (booking, transfer, questionnaire), in house (room, next procedure, orders), after departure (course summary and hotel offers). |
| **Trip** | Booking and the hotel’s reply, transfer, room, board, orders, folio, arrival time, late-checkout request. |
| **Care** | This person’s full timetable, published results, past episodes, lead alert and alarm. A family cabinet is a second entrance here, without the other person’s results. |
| **Hotel** | Packages, prices, holidays, season, how to get there, what can be ordered ahead. |

The bell is one inbox (reception, clinic, marketing). Marketing can be muted without muting the clinic.

Care and Hotel never share a screen. Questionnaire, MRZ, family linking, and sign-in are not menu items. They open from Today or the profile when that step is due.

### 10. What the organization owner edits

The owner edits content and brand. The owner does not edit behavior. Clinical privacy, sign-in, the offline pack, the MRZ frame, check-in required fields, and “booking is a request” stay in the product.

**Orchestrator, on the organization, without a new binary** (a Guest app section beside the existing profile and branding card, not a reuse of letterhead):

- App display name, logo, primary color.
- Default language and consent texts.
- Desk phone and doctor-on-duty contact.
- Hotel information: packages, prices, holidays, season, photos, what to bring.
- Which room orders exist (housekeeping, water, minibar, late checkout) and their labels.
- Post-stay message and offer texts.
- Lead-alert default: 5 or 10 minutes, inside the window already fixed in §3.

**New store binary only:** home-screen name, home-screen icon, bundle id, push certificate. ERA builds and uploads that binary. The listing brand is the hotel’s. The store account is agreed per hotel.

Color and logo paint this construction. There is no per-tenant menu designer.

### 11. Cycle 1 — the frame that later cycles attach to

Cycle 1 ships the construction and the orchestrator section. It does not ship QR, MRZ, folio, timetable, or store upload.

**Orchestrator**

- The phone project is `apps/guest-app`. It reads `GET /platform/v1/guest-app/:organizationId/brand` with no service token in the binary. The same payload is on `GET /internal/v1/organizations/:id/guest-app-snapshot` for servers. A disabled or missing row is an empty brand, not another hotel.
- OrgOwner section **Guest app** on the organization workspace, next to profile and branding.
- Fields this cycle actually stores: enabled, display name, primary color, logo, default locale (`az` / `ru` / `en`), desk phone.
- `GET` for the OrgOwner and a service snapshot the app can read for the baked `organizationId`. Letterhead snapshot stays the print SoR. Guest-app fields are not stuffed into `org.logoUrl` / letterhead.
- Super-admin can open the same section for an organization. A DEPARTMENT org does not inherit another org’s guest-app brand unless a later ADR says so.

**App**

- Expo app at `apps/guest-app`, TypeScript, one dev tenant and API base in build config (the white-label slot). No in-app org switch. Hotel guest Nest routes are registered in `era-hotel-pms/nest/guest-app-routes.ts` (not Next `app/api`).
- Four tabs and the bell, labels in az / ru / en.
- Brand from the orchestrator snapshot: name, color, logo. Missing brand uses a neutral fallback and does not invent Nafta.
- Today renders three phases from a review flag (`before` / `in_house` / `after`) so the shell can be walked. The flag is not an owner setting and does not pretend to be a guest’s real stay. Each phase lists the rows §9 names and marks every row not built yet as not available. No fake booking, no fake lab.
- Trip, Care, Hotel, and the bell open and state what the next cycle will put there. They do not call hotel or clinic staff APIs.

**Done when**

- An owner saves the Guest app section and the running app shows that name, color, and logo.
- Switching the phase flag changes Today and leaves the other three tabs in place.
- A row with no cycle behind it cannot be mistaken for a working feature.

**After cycle 1, in order:** desk QR and the offline “we are coming” card with transfer; questionnaire and MRZ (guest and hotel UI); booking request; room orders; timetable and alarm; published results and past episodes; family cabinets; sign-in by the phone number on file; Hotel catalog and post-stay offers. Each of those is its own cycle, attached to this frame.

## Harden waves (post cycles 1–10)

Orchestrator live phone preview binds to Guest app form state (no hotel Nest from orch). Care S2S requires `CLINIC_INTERNAL_URL`/`CLINIC_URL` + service token; results are org-scoped published-only. Device offline pack caches Care/catalog and queues outbound orders as `QUEUED` until flush. Local lead alerts use `expo-notifications`; remote push stays STUB until EAS certs. Bell inbox is `GuestAppMessage` with marketing mute. Store white-label ops: `docs/runbooks/guest-app-white-label-store.md`. UAT evidence path: `reports/guest-app-uat-smoke.md` — stay yellow until signed.

## Product shell polish (post harden)

`apps/guest-app` is split into `theme` / `ui` / `chrome` / `copy` / `screens/*` with a thin `App.tsx` wiring layer. Today is trip-phase driven (before / in_house / after) — no manual phase toggles and no scaffold placeholder rows. Auth (desk code, phone OTP, confirmation pack) is a single block when the trip is locked. Care / Trip / Bell / Hotel use list rows with offline cache stamps. Locale strings are product copy (az/ru/en). Status stays SCREEN / API 🟡 until device UAT is signed — not SHOW / not SHIPPED.

## Consequences

- Navigation and the owner boundary are decided (§9, §10). Visual design of each later screen is still per cycle.
- Hotel reception implements the same MRZ frame as the guest app. The two clients do not grow two meanings of red and green.
- Guest capabilities are not SHIPPED, not Scaffold ✅, and not a sell claim. When a wave is built, the actor is the guest, not OpsUI or SatAdmin. Reception’s MRZ frame is staff UI and is specified here only so the capture rule stays one rule.
- Clinic publish and payment gates stay the clinic’s.
- Family access, offline cache, and MRZ images are operational. They do not move the identity system of record out of MDM.

## Out of scope

- One ERA app in which the guest picks a hotel or a tenant.
- Staff housekeeping boards, clinical charting, and folio posting screens.
- Live sale of a specific room and rate, digital door keys, card acquiring, tips, and a points programme.
- Storing FIN or passport as the system of record on the phone or in a new guest table.
- Treating a confirmation number, a forwarded voucher, or a photographed desk QR from yesterday as access to analyses.
- Signing one spouse in with the other spouse’s identity.
