# ASAN İmza / SİMA gov signature channel (Wave 4)

## Status

Accepted — foundation seam for tax declarations, e-Qaimə S2S, and reconciliation act signing.

## Context

ERA Finance signs gov payloads through a live ASAN/SİMA adapter unless the organization turns on `settings.tax.signatureGatewayMock`. Wave 4 adds a **gov-payload** signing channel reused by:

- `TaxExportService.submitDeclaration` (profit/payroll/etc.)
- `EqaimeSubmissionService.submit`
- Reconciliation act initiate/status (`SignedDocumentKind.RECONCILIATION_ACT`)

## Decision

1. **`GovSignatureAdapter`** interface with `MockGovSignatureAdapter` (dev) and `AsanSimaGovSignatureAdapter` (live).
2. Factory uses the live adapter unless `Organization.settings.tax.signatureGatewayMock` is true. The stub is off by default. `SIGNATURE_GATEWAY_MOCK` and `ERA_ASAN_SIMA_LIVE` are not read.
3. **Org config:** `Organization.settings.tax.asanUserId` (same field as e-taxes HSM seam, configured in org settings UI).
4. Invoice PDF signing path unchanged; gov payloads use `SignatureService.signGovPayload`.

## Env

| Variable | Role |
|----------|------|
| `ASAN_IMZA_API_URL` | Live ASAN İmza signing endpoint |
| `SIMA_QR_PAYLOAD_URL` | SİMA QR / biometric signing endpoint |

The stub switch is `Organization.settings.tax.signatureGatewayMock` (default false). Taxpayer lookup stub is `Organization.settings.tax.taxLookupMock` (default false).

## Consequences

- Without partner URLs/certs, the live adapter returns **503**. The stub stays off until the org setting is turned on.
- Reconciliation PDF reads completed `digital_signature_logs` for verify QR (existing behavior).
- e-Qaimə S2S still gated separately by `ERA_EQAIME_S2S_ENABLED`.
