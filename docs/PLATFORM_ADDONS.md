# Platform add-ons catalog

Cross-cutting commercial services sold **on top of** ERA Core and industry satellites. Implemented and billed from **era-orchestrator** (control plane), not from individual vertical apps.

**Commercial claim / edition honesty:** MODULES or add-on **DONE** ≠ product `ga`. See [`docs/editions/`](./editions/) and [`docs/acceptance/`](./acceptance/README.md) ([ERA-Acceptance-Standard](./products/ERA-Acceptance-Standard.md)).

**Billing model:** see [CONTROL_PLANE_ARCHITECTURE.md](./CONTROL_PLANE_ARCHITECTURE.md) — modules/add-ons on **monthly post-paid** invoice; ERA Core + ERA Banking Core foundations (banking gated on `industry_banking`); metered channels (messages, storage, OCR pages over tier) on **live tier/quota accumulation**.

---

## Design principles

1. **One entitlement slug per add-on** in `organization_modules` / pricing catalog (e.g. `platform_notifications`, `platform_booking`).
2. **One API** per add-on family under `/platform/*` on orchestrator; satellites call with org service token or user JWT.
3. **No duplicate billing** in Finance or satellites — Finance only posts **accounting** entries if needed (e.g. recognize platform revenue internally).
4. **Separate from vertical CRM** — e.g. `industry_crm` = pre-sale conversations; Notifications Pack = transactional outbound.

---

## Add-on matrix

| Slug (draft) | Name | Primary users | Monetization | Status |
|--------------|------|---------------|--------------|--------|
| `platform_notifications` | **Notifications Pack** | All verticals + Finance | **19 AZN**; 5k email + 10k push; WA **0.05**/msg | **Production-ready (CP-B2)** |
| `platform_booking` | **Online Booking Widget** | Clinic, auto-sto, retail pickup, hotel spa | **29 AZN** | **Live** (CP-B3, v2.0) |
| `platform_portal` | **Customer Portal** | All B2C-facing verticals | **19 AZN** | **Live** (CP-B4, v2.0) |
| `platform_payments` | **Payment links & deposits** | Finance invoices, booking deposits | take-rate **1.5%** (0 base SKU) | **Live** (CP-B5, v2.0) |
| `platform_loyalty` | **Loyalty & promotions** | Retail, clinic storefront | **29 AZN**; XOR `retail_promotions` | **Live** (CP-B6, v2.0) |
| `platform_domain` | **Custom domain & white-label** | Storefront, portal, booking | **19 AZN** | **Live** (CP-B7, v2.0) |
| `platform_delivery` | **Delivery orchestration** | Retail e-commerce + logistics | **29 AZN**; XOR `fnb_delivery_hub` | **Live** (CP-B8, v2.0) |
| `platform_storage` | **Cloud object storage (S3)** | All products (attachments, exports) | **19 AZN** incl. 20 GB; **0.50 AZN/GB** | **Live** |
| `platform_reference_data` | **ERA Data Hub Bronze** | All verticals + external API | **29 AZN**; XOR Silver/Gold | **Live** |
| `platform_datahub_silver` | **Data Hub Silver** | VÖEN enrich | **39 AZN** | Catalog 2026-09 |
| `platform_datahub_gold` | **Data Hub Gold** | Real-time / BI | **99 AZN** | Catalog 2026-09 |
| `platform_workforce_base` / `_pro` | **Workforce headcount** | HRIS | **2 / 4 AZN per person** (XOR) | Hub SKU `platform_workforce` |

**Bundles (commercial packaging):**

| Bundle | Modules | Target vertical |
|--------|---------|-----------------|
| **Commerce** | notifications + payments + delivery + domain | retail e-commerce |
| **Care** | booking + notifications + portal | clinic |
| **Fleet & Service** | booking + notifications + vehicle reminders | auto-sto |

**Not platform add-ons:** ElectraWeb hotel features (Channel Manager, SPA, Guest tasks, Banquets…) are **`hotel_*` modules** in `pricing_modules`, gated by `industry_hotel_pms`. See [`docs/adr/hotel-module-taxonomy.md`](./adr/hotel-module-taxonomy.md) and [`MODULES_CATALOG.md`](./MODULES_CATALOG.md) § Hospitality.

---

## 1. Notifications Pack

**Purpose:** Unified outbound **transactional** messaging to end customers and counterparties.

### Channels

| Channel | Use cases | Notes |
|---------|-----------|-------|
| **Email** | Invoice PDF, portal link | Already in Finance (`send-email` on sales invoice); merge into Pack outbox |
| **WhatsApp** | Invoice, act, payment reminder, appointment confirm | Official WABA; PRD §6.8 |
| **SMS** | Reminders, tracking codes | Pro tier or metered |

### Message classes

| Class | Initiator | Consent |
|-------|-----------|---------|
| **Financial** | Finance | Verified counterparty only |
| **Transactional** | Satellite | Service relationship (booking, order) |
| **Lifecycle** | Satellite | Opt-in recommended (maintenance due) |
| **Marketing** | Satellite / Loyalty | Strict opt-in; separate quota |

### Triggers (examples)

| Source app | Template | Pack action |
|------------|----------|-------------|
| Finance | Sales invoice issued | WA/email + payment link |
| Finance | Reconciliation act | WA/email |
| Clinic | Appointment in 24h | SMS/WA reminder |
| Clinic | Lab results ready | Portal link via WA |
| Auto STO | Service due by mileage | WA + booking deep link |
| Retail | Order shipped | WA/SMS + tracking |
| Hotel | Pre-arrival info | WA (operational; not duplicate GL invoice) |

### Billing (aligned with post-paid + tier meter)

- **Included:** `maxWhatsappAlertsPerMonth` (and future SMS) per **credit tier** — tracked in `whatsappAlertsUsed` / CP `tenant_billing`.
- **Over tier included count:** meter `pricePerWhatsappAlertAzn` → `accumulatedBalance` in current period.
- **Legacy:** `whatsappOutboundMessagesBalance` prepaid — **deprecated**; do not extend.

### Boundary vs `industry_crm`

| | CRM + WhatsApp (vertical) | Notifications Pack |
|--|---------------------------|-------------------|
| UX | Two-way chat in lead card | System templates, delivery log |
| Sales stage | Pre-sale | Post-sale / operations |
| Billing | Vertical entitlement | Platform add-on + usage |

### Target API (orchestrator)

```http
POST /platform/notifications/v1/send
{
  "organizationId": "uuid",
  "channel": "whatsapp" | "sms" | "email",
  "templateKey": "invoice_issued_v1",
  "recipient": { "counterpartyId" | "phone" | "email" },
  "variables": { ... },
  "source": { "app": "era-finance-core", "entityType": "sales_invoice", "entityId": "..." }
}
```

Response: `messageId`, `deliveryStatus`; async webhook from provider updates outbox.

---

## 2. Online Booking Widget

**Purpose:** Embeddable or hosted booking for time-based services.

**Features:** service catalog hook, staff/resource calendar, conflict rules, optional deposit (→ Payment add-on), confirm/cancel notifications (→ Notifications Pack).

**Clients:** clinic appointments, auto-sto bays, retail click-and-collect slots, hotel spa (not room nights — those stay in hotel PMS).

**Monetization:** base fee per org; premium for custom domain embed.

---

## 3. Customer Portal

**Purpose:** End-customer self-service: order status, visit history, documents, pay open invoices.

**Auth:** magic link / SMS OTP (via Notifications Pack).

**Monetization:** basic portal with Finance AR; branded portal + custom domain as premium.

**Finance boundary:** portal **displays** Finance-issued invoice PDFs and payment state; does not create GL entries.

---

## 4. Payment links & deposits

**Purpose:** Acquiring for invoice pay-by-link and booking deposits.

**Integration:** Payment link embedded in WhatsApp invoice message; webhook → Finance marks payment / satellite confirms booking.

**Monetization:** platform take rate or pass-through + fixed fee per org.

---

## 5. Loyalty & promotions

**Purpose:** Promo codes, points, bundles on clinic/retail storefronts.

**Integration:** Storefront (Booking or vertical UI) validates code; settlement events to Finance optional.

**Monetization:** module fee; marketing sends billed as Notifications **marketing class**.

---

## 6. Custom domain & white-label

**Purpose:** `shop.client.az`, `booking.client.az`, TLS, basic theme.

**Monetization:** recurring per domain; low marginal cost, high perceived value.

**Implementation:** orchestrator provisioning + CDN; entitlements gate DNS activation.

---

## 7. Delivery orchestration

**Purpose:** Retail online orders → shipment, courier assignment, tracking number.

**Integration:** optional **era-logistics** trip; status → Notifications Pack; inventory movement → Finance.

**Monetization:** module + per-shipment meter.

---

## 8. Cloud object storage (`platform_storage`)

**Purpose:** Shared attachments and exports (invoice PDFs, satellite uploads, export archives) via S3-compatible storage or local disk in dev.

**Package:** [`packages/era-storage`](../packages/era-storage) — `createStorageService()`, drivers `local` and `s3`. Finance API imports `@era/storage` in `storage.module.ts`.

**Satellite integration:** import `@era/storage` **only in server routes** (e.g. `app/api/uploads/route.ts`). Do **not** re-export from `@era/satellite-kit` main barrel (webpack `node:fs` on client). Gate routes with entitlement check + `PLATFORM_STORAGE_ENABLED=true`.

**Reference:** `era-retail-pos/app/api/uploads/route.ts`.

**Monetization:** module fee + GB meter over tier included storage (`maxStorageGb`).

---

## Entitlements in pricing catalog

Add to orchestrator `pricing_modules` (Super-Admin):

| key | kind | notes |
|-----|------|-------|
| `platform_notifications` | ADDON | Notifications Pack **19 AZN** |
| `platform_notifications_sms` | ADDON | SMS meter (0 base) |
| `platform_booking` | ADDON | Booking widget **29** |
| `platform_portal` | ADDON | Customer portal **19** |
| `platform_payments` | ADDON | Payment links, 1.5% take-rate |
| `platform_loyalty` | ADDON | Loyalty engine **29** |
| `platform_domain` | ADDON | Custom domain **19** |
| `platform_delivery` | ADDON | Delivery orchestration **29** |
| `platform_storage` | ADDON | S3 **19** + GB meter |
| `platform_reference_data` | ADDON | Data Hub Bronze **29** |
| `platform_datahub_silver` | ADDON | Data Hub Silver **39** |
| `platform_datahub_gold` | ADDON | Data Hub Gold **99** |
| `platform_workforce_base` | ADDON | Headcount 2 AZN |
| `platform_workforce_pro` | ADDON | Headcount 4 AZN |

Industry slugs (`industry_clinic`, `industry_hotel_pms`, …) remain **separate** — they gate satellite app access; platform add-ons gate **shared services** inside those apps.

---

## Implementation roadmap (documentation-only)

| Phase | Scope |
|-------|--------|
| **CP-BILLING** | Entire commercial control plane Finance → orchestrator — [CP-BILLING-MIGRATION.md](./CP-BILLING-MIGRATION.md) |
| **CP-PLATFORM-*** | Platform add-ons **after** CP-BILLING (Notifications, Booking, Portal, …) — [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md) |

Track in [era-orchestrator/doc/DELIVERY-ORCHESTRATOR.md](../era-orchestrator/doc/DELIVERY-ORCHESTRATOR.md) section CP-BILLING / CP-PLATFORM.

---

## Live mode (v2.0) — environment

| Add-on | Variable | Default | Notes |
|--------|----------|---------|-------|
| All platform APIs | `PLATFORM_ADDONS_MODE` | `live` | `mvp` restores v1.0 stub responses |
| Booking | `PLATFORM_BOOKING_WEBHOOK_URL` | — | Outbound cancel/confirm |
| Delivery | `PLATFORM_DELIVERY_WEBHOOK_URL` | — | Status transitions |
| Notifications WA | `WHATSAPP_BUSINESS_MODE` | `mock` | `live` → WABA adapter |
| Storage | `PLATFORM_STORAGE_ENABLED` | `false` | `true` + `STORAGE_DRIVER=s3` for uploads |
| Storage S3 | `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | — | Local dev: `STORAGE_DRIVER=local`, `STORAGE_LOCAL_PATH` |
| Idempotency / audit | (Prisma) | on in live | `PlatformIdempotencyRecord`, `PlatformAuditLog` |
| Reference Data (Data Hub) | `PLATFORM_REFERENCE_DATA_MODE` | `mvp` on hub | `live` → orchestrator `POST /platform/reference-data/v1/validate-key` |
| Reference Data keys | `REFERENCE_DATA_VALID_API_KEYS` | — | `key:orgUuid` comma list on orchestrator |
| Hub dev keys | `DATA_HUB_DEV_API_KEYS` | `dev-data-hub-key` | MVP mode on `era-data-hub` |

Consumer integration: [era-data-hub/doc/DATA-HUB-CONSUMER.md](../era-data-hub/doc/DATA-HUB-CONSUMER.md).

---

## Related

- [CONTROL_PLANE_ARCHITECTURE.md](./CONTROL_PLANE_ARCHITECTURE.md)
- [MODULES_CATALOG.md](./MODULES_CATALOG.md)
- Finance PRD §6.8 (WhatsApp), §7.12 (post-paid), §16 (tier meter)
