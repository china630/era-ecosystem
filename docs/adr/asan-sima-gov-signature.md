# ASAN İmza / SİMA gov signature channel (Wave 4)

## Status

Accepted — foundation seam for tax declarations, e-Qaimə S2S, and reconciliation act signing.

## Context

ERA Finance already mocks mobile signature for sales invoice PDFs (`SIGNATURE_GATEWAY_MOCK=1`). Wave 4 adds a **gov-payload** signing channel reused by:

- `TaxExportService.submitDeclaration` (profit/payroll/etc.)
- `EqaimeSubmissionService.submit`
- Reconciliation act initiate/status (`SignedDocumentKind.RECONCILIATION_ACT`)

## Decision

1. **`GovSignatureAdapter`** interface with `MockGovSignatureAdapter` (dev) and `AsanSimaGovSignatureAdapter` (live).
2. Factory selects live when `ERA_ASAN_SIMA_LIVE=1` **or** `SIGNATURE_GATEWAY_MOCK=0`.
3. **Org config:** `Organization.settings.tax.asanUserId` (same field as e-taxes HSM seam, configured in org settings UI).
4. Invoice PDF signing path unchanged; gov payloads use `SignatureService.signGovPayload`.

## Env

| Variable | Role |
|----------|------|
| `ASAN_IMZA_API_URL` | Live ASAN İmza signing endpoint |
| `SIMA_QR_PAYLOAD_URL` | SİMA QR / biometric signing endpoint |
| `ERA_ASAN_SIMA_LIVE` | `1` forces live adapter (default `0`) |
| `SIGNATURE_GATEWAY_MOCK` | `0` also forces live adapter |

## Consequences

- Without partner URLs/certs, live adapter returns **503** with explicit codes; mock remains default for local UAT.
- Reconciliation PDF reads completed `digital_signature_logs` for verify QR (existing behavior).
- e-Qaimə S2S still gated separately by `ERA_EQAIME_S2S_ENABLED`.
