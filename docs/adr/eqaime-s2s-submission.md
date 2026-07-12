# e-Qaimə S2S submission (Wave 4)

## Status

Accepted — server-side e-Qaimə issue behind feature flag; RPA remains primary until DVX B2B credentials are provisioned.

## Context

ERA Finance Phase 2 (browser extension) pre-fills e-qaimə portal forms from invoice data. Wave 4 adds a **server-to-server** path for background issue and status tracking when the organization has DVX B2B access, reusing the e-taxes submission and gov-signature seams from Waves 1–2 and Wave 4 Block C.

## Decision

### Service and endpoints

- **`EqaimeSubmissionService`** (`apps/api/src/invoices/eqaime-submission.service.ts`) builds a versioned JSON package from `InvoicesService.getExtensionPrefill` plus issuer VÖEN / ASAN context.
- **API:** `GET /api/invoices/:id/eqaime/status`, `POST /api/invoices/:id/eqaime/submit`.
- **UI:** `/sales/invoices` — status column + «Submit e-Qaimə» when S2S is enabled; bulk RPA unchanged.

### Invoice persistence

Fields on `Invoice`:

| Field | Purpose |
|-------|---------|
| `eqaimeNumber` | DVX-assigned number after accept |
| `eqaimeStatus` | `EqaimeStatus` enum (draft / submitted / accepted / rejected / cancelled) |
| `eqaimeSubmittedAt` | UTC timestamp of last S2S attempt |

Existing `dvxSync*` fields remain for network-inbox / reconciliation flows.

### Submission channel

1. Guard: `ERA_EQAIME_S2S_ENABLED=1` (otherwise **503** `EQAIME_S2S_DISABLED` + RPA fallback message).
2. Build package → **`SignatureService.signGovPayload`** (purpose `EQAIME_SUBMIT`) when gov signing is required.
3. Submit via **`EtaxesSubmissionAdapter`** destination `etaxes_eqaime` → `E_TAXES_EQAIME_SUBMIT_URL`.

### RPA and incoming flows (unchanged primary path)

- Extension connector `erp-to-eqaime.ts` — line-items prefill; user signs on portal.
- **Network inbox:** `GET network/documents/inbox/:id/eqaime-prefill` for cross-org prefill; incoming pull to purchase drafts remains partial (PRD M1).

### Entitlements

- Submit endpoint gated by `@RequiresModule(tax_pro)` + `SubscriptionGuard` (Wave 4 Block F).
- Prefill / status read available to invoice roles without submit when flag off.

## Env

| Variable | Role |
|----------|------|
| `ERA_EQAIME_S2S_ENABLED` | `1` enables S2S submit |
| `E_TAXES_EQAIME_SUBMIT_URL` | HTTP gateway for signed e-Qaimə packages |
| `ERA_ETAXES_HSM_ENABLED` | Optional HSM adapter instead of plain HTTP |
| `ERA_ASAN_SIMA_LIVE` | Live gov-payload signing (see [asan-sima-gov-signature.md](./asan-sima-gov-signature.md)) |

Org ASAN ID: `Organization.settings.tax.asanUserId`.

## Consequences

- Without partner URL + flag, production behaviour is **RPA prefill only** — honest **STUB/API** in COVERAGE_MATRIX.
- Live DVX response parsing and idempotent retries are follow-ups when pilot credentials arrive.
- Hotel and other satellites remain read-only for e-Qaimé issuance per [hotel-eqaime-readonly-boundary.md](./hotel-eqaime-readonly-boundary.md).

## Related

- [etaxes-hsm-asan-submission.md](./etaxes-hsm-asan-submission.md)
- [asan-sima-gov-signature.md](./asan-sima-gov-signature.md)
