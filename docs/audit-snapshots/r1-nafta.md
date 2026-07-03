# R1 — Nafta pilot appendix (2026-06-16)

Subset audit for Nafta sanatorium stack per [NAFTA_DOC_API_UI_AUDIT.md](../NAFTA_DOC_API_UI_AUDIT.md) and [NAFTA_SANATORIUM_UAT.md](../NAFTA_SANATORIUM_UAT.md).

---

## Stack entitlements

| Satellite | Integration focus | R1 status |
|-----------|-------------------|-----------|
| `era-hotel-pms` | Guest MDM W4, import, tourism | **COMPLIANT** |
| `era-clinic` | Patient/practitioner MDM W1, sanatorium episodes | **COMPLIANT** |
| `era-fnb-pos` | Staff provision event-only | **COMPLIANT** |

---

## Guest Cards import (~7 383 rows)

| Check | Expected (W4) | R1 verification |
|-------|---------------|-------------------|
| Idempotency | `Guest.externalRef` = Elektraweb Guest Id | Unchanged — [ELEKTRAWEB-IMPORT.md](../../era-hotel-pms/doc/ELEKTRAWEB-IMPORT.md) |
| Identity | Resolve via MDM; no `nationalIdFin`/`passportNumber` on `Guest` | **PASS** — `guests.adapter.ts` resolve-only; schema DROP migration |
| Pre-cutover | backfill + `report-guests-without-mdm-link.ts` | Documented in [NAFTA-GUEST-INTELLIGENCE.md](../../era-hotel-pms/doc/NAFTA-GUEST-INTELLIGENCE.md) |
| Audit | No `PII_DUPLICATE` for hotel | **PASS** — strict suite 0 issues |

---

## Hotel → clinic lifecycle bus

| Check | R1 status |
|-------|-----------|
| Orchestrator fan-out only (no direct HTTP clinic↔hotel for identity) | **COMPLIANT** — satellite-events queue |
| Sanatorium episode bridge | Documented in clinic DELIVERY; idempotency tests exist |

---

## 1C-only / no Finance HR (Nafta policy)

| Check | R1 status |
|-------|-----------|
| `hireMode=local_master` when Finance HR not entitled | **W3** — `GET /platform/v1/workforce/policy`; clinic POST practitioners allowed with strict MDM |
| SatAdmin hire blocked when `finance_hr` | **PASS** — `WORKFORCE_HIRE_VIA_FINANCE` guard |

---

## Calendar / tourism / compliance

| Check | R1 status |
|-------|-----------|
| Production calendar | Platform gateway via `@era/satellite-kit` — no Finance container required |
| Tourism export | MDM `resolveIdentifierForCompliance` at submit (W4) |
| Migration prefill | Same MDM resolve pattern |

---

## Open Nafta items (non-integration)

Per [NAFTA_DOC_API_UI_AUDIT.md](../NAFTA_DOC_API_UI_AUDIT.md) — product/UI gaps outside R1 integration scope remain tracked there.

**Integration gate for Nafta prod cutover:** R1 automated strict **green** + guest import runbook executed on staging.
