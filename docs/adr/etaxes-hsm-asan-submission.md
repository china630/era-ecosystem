# ADR: e-taxes / ASAN ID + HSM submission channel

- **Status:** Accepted (Wave 1 foundation)
- **Date:** 2026-07-11
- **Related:** [etaxes-voen-unblock-checklist.md](./etaxes-voen-unblock-checklist.md), ERA Finance PRD §6.1.1

## Context

ERA Finance already builds ƏDV declaration packages (`ETaxesIntegrationService.buildDeclarationPackage`) and can POST them to a configured gateway URL (`E_TAXES_VAT_SUBMIT_URL`). Production cutover with the tax / customs / social portals will use a **dedicated HSM** and the organization's **ASAN ID**, approximately one month after partner credentials are provisioned.

We need a single submission seam that:

1. Works today without HSM (HTTP JSON gateway).
2. Switches to HSM + ASAN signing behind a feature flag without rewriting call sites.
3. Reuses the same channel later for customs (BGD) and DSMF / payroll declarations.

## Decision

### Organization ASAN ID

Store the subscriber / user id at:

```text
Organization.settings.tax.asanUserId  (string | null)
```

Editable via `PATCH /api/organization/settings` (`asanUserId` field) and the organization settings UI.

Per-user ASAN IDs are deferred; Wave 1 is org-level only.

### System / env configuration

| Key | Layer | Purpose |
|-----|-------|---------|
| `E_TAXES_VAT_SUBMIT_URL` | env | HTTP gateway for VAT packages (default path) |
| `ERA_ETAXES_HSM_ENABLED` | env | `1` / `true` selects HSM adapter |
| `ERA_HSM_URL` | env | Fallback HSM endpoint |
| `ERA_ASAN_GATEWAY_URL` | env | Fallback ASAN gateway |
| `integrations.etaxes.hsmUrl` | `system_config` | Super-Admin override for HSM URL |
| `integrations.asan.gatewayUrl` | `system_config` | Super-Admin override for ASAN gateway |

### Adapter seam

Interface: `EtaxesSubmissionAdapter` (`apps/api/src/reporting/etaxes-submission.adapter.ts`).

Implementations:

- **`HttpEtaxesSubmissionAdapter`** — POST JSON to `E_TAXES_VAT_SUBMIT_URL` (current behaviour).
- **`HsmEtaxesSubmissionAdapter`** — requires `asanUserId` + HSM/ASAN URLs; **seam only** until live HSM client is wired (returns `503 E_TAXES_HSM_NOT_READY` with payload hash for audit).

Factory: `EtaxesSubmissionAdapterFactory` selects adapter from `ERA_ETAXES_HSM_ENABLED`.

Call site: `ETaxesIntegrationService.submitDeclarationToGateway` → `adapter.submit(package, { organizationId, asanUserId, destination })`.

### Destinations (Wave 2 extension)

| `destination` | Declaration / channel | Status |
|---------------|----------------------|--------|
| `etaxes_vat` | ƏDV quarterly declaration | Wave 1 — HTTP gateway live |
| `etaxes_profit_tax` | Mənfəət vergisi (annual) | Wave 2 — file generate + seam; HSM when enabled |
| `etaxes_payroll_withholding` | Unified payroll withholding (PIT + social) | Wave 2 — file generate + seam |
| `dsmf` | DSMF / social fund payroll report (same payload family as withholding) | Wave 2 — reserved on seam; submit behind flags |
| `customs` | BGD / customs (future) | Reserved |
| `etaxes_other` | Catch-all e-taxes | Reserved |

Tax export submit: `TaxExportService.submitDeclaration` routes `TaxDeclarationType` → destination (`PROFIT_TAX` → `etaxes_profit_tax`, `PAYROLL_WITHHOLDING` → `etaxes_payroll_withholding` / `dsmf` per adapter config).

ƏMAS contract lifecycle uses a **separate** adapter (`EmasSubmissionAdapter`, `ERA_EMAS_S2S_ENABLED`) but shares ASAN/HSM signer context where configured.

### Flow

```text
VAT UI → POST …/etaxes-vat-declaration/submit
  → buildDeclarationPackage()
  → resolveSignerContext(settings.tax.asanUserId)
  → EtaxesSubmissionAdapterFactory.get()
       ├─ HTTP  → POST E_TAXES_VAT_SUBMIT_URL
       └─ HSM   → sign via HSM/ASAN (when live) → gov gateway
```

## Consequences

- Feature flag keeps production safe until HSM certs arrive.
- Org ASAN ID is required only when HSM mode is on.
- Live HSM client is a follow-up PR (Wave 4 / E3+G7); this ADR documents the contract.
- Audit trail for successful HSM submits should write `DigitalSignatureLog` when the live client lands.

## Non-goals (Wave 1)

- Real ASAN İmza / SİMA Mobile ID API integration for PDF invoices — **Wave 4 G7** adds gov-payload adapter ([asan-sima-gov-signature.md](./asan-sima-gov-signature.md)); PDF path still mock-first.
- S2S e-qaimə issuance — **Wave 4 E3** seam behind `ERA_EQAIME_S2S_ENABLED` ([eqaime-s2s-submission.md](./eqaime-s2s-submission.md)); RPA remains primary without creds.
- Per-user ASAN ID picker.
