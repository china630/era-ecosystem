# Platform add-ons catalog

Cross-cutting commercial services sold **on top of** ERA Core and industry satellites. Implemented and billed from **era-365-orchestrator** (control plane), not from individual vertical apps.

**Billing model:** see [CONTROL_PLANE_ARCHITECTURE.md](./CONTROL_PLANE_ARCHITECTURE.md) — modules/add-ons on **monthly post-paid** invoice; metered channels (messages, storage over tier) on **live tier/quota accumulation**.

---

## Design principles

1. **One entitlement slug per add-on** in `organization_modules` / pricing catalog (e.g. `platform_notifications`, `platform_booking`).
2. **One API** per add-on family under `/platform/*` on orchestrator; satellites call with org service token or user JWT.
3. **No duplicate billing** in Finance or satellites — Finance only posts **accounting** entries if needed (e.g. recognize platform revenue internally).
4. **Separate from vertical CRM** — e.g. `industry_crm_whatsapp` = pre-sale conversations; Notifications Pack = transactional outbound.

---

## Add-on matrix

| Slug (draft) | Name | Primary users | Monetization | Status |
|--------------|------|---------------|--------------|--------|
| `platform_notifications` | **Notifications Pack** | All verticals + Finance | Tier-included WA/email alerts + meter overlimit; SMS as Pro | **Live (CP-B2)** on orchestrator |
| `platform_booking` | **Online Booking Widget** | Clinic, auto-sto, retail pickup, hotel spa | +AZN/mo per bookable resource group | **Stub API** (CP-B3) |
| `platform_portal` | **Customer Portal** | All B2C-facing verticals | Basic included; white-label + custom domain premium | **Stub API** (CP-B4) |
| `platform_payments` | **Payment links & deposits** | Finance invoices, booking deposits | % or fixed per successful payment | **Stub API** (CP-B5) |
| `platform_loyalty` | **Loyalty & promotions** | Retail, clinic storefront | +AZN/mo; marketing messages use Notifications meter | **Stub API** (CP-B6) |
| `platform_domain` | **Custom domain & white-label** | Storefront, portal, booking | +AZN/mo per domain | **Stub API** (CP-B7) |
| `platform_delivery` | **Delivery orchestration** | Retail e-commerce + logistics | +AZN/mo + per-shipment meter | **Stub API** (CP-B8) |

**Bundles (commercial packaging):**

| Bundle | Modules | Target vertical |
|--------|---------|-----------------|
| **Commerce** | notifications + payments + delivery + domain | retail e-commerce |
| **Care** | booking + notifications + portal | clinic |
| **Fleet & Service** | booking + notifications + vehicle reminders | auto-sto |

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

### Boundary vs `industry_crm_whatsapp`

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

## Entitlements in pricing catalog

Add to orchestrator `pricing_modules` (Super-Admin):

| key | kind | notes |
|-----|------|-------|
| `platform_notifications` | MODULE | Notifications Pack base |
| `platform_notifications_sms` | MODULE | SMS enablement |
| `platform_booking` | MODULE | Booking widget |
| `platform_portal` | MODULE | Customer portal |
| `platform_payments` | MODULE | Payment links |
| `platform_loyalty` | MODULE | Loyalty engine |
| `platform_domain` | MODULE | Custom domain |
| `platform_delivery` | MODULE | Delivery orchestration |

Industry slugs (`industry_clinic`, `industry_hotel_pms`, …) remain **separate** — they gate satellite app access; platform add-ons gate **shared services** inside those apps.

---

## Implementation roadmap (documentation-only)

| Phase | Scope |
|-------|--------|
| **CP-BILLING** | Entire commercial control plane Finance → orchestrator — [CP-BILLING-MIGRATION.md](./CP-BILLING-MIGRATION.md) |
| **CP-PLATFORM-*** | Platform add-ons **after** CP-BILLING (Notifications, Booking, Portal, …) — [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md) |

Track in [era-365-orchestrator/doc/DELIVERY-ORCHESTRATOR.md](../era-365-orchestrator/doc/DELIVERY-ORCHESTRATOR.md) section CP-BILLING / CP-PLATFORM.

---

## Related

- [CONTROL_PLANE_ARCHITECTURE.md](./CONTROL_PLANE_ARCHITECTURE.md)
- [MODULES_CATALOG.md](./MODULES_CATALOG.md)
- Finance PRD §6.8 (WhatsApp), §7.12 (post-paid), §16 (tier meter)
