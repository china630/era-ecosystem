# Clinic patient portal v2 (MED-P1-01)

## Status

Accepted — partial 2026-11-25 (token/QR session only).

## Context

Patients need a low-friction way to see appointments and published lab results without staff SSO.

## Decision

- `GET /api/portal/session` accepts portal/QR token (OTP-less); returns structured `labResults[]` + `appointments[]`; audit `PORTAL_ACCESS`.
- UI `/portal` is public (middleware allowlist) with results table + appointments + video join link when present.
- OTP phone login, document vault, and Finance payment links are **out of this wave**.

## Consequences

- `platform_portal` gate still applies.
- No self-booking mutations on the portal surface in this scaffold.

## Related

- [02-remediation-backlog.md](./02-remediation-backlog.md) MED-P1-01
- COVERAGE `CLI-PORTAL-V2`
