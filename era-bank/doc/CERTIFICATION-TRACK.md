# Bank certification track (post ops-mvp)

Parallel roadmap — **does not block** teller back-office **lab-pilot**. Engine CBS MVP (P0–P7) and ops UI **ops-mvp** are prerequisites. Product edition `ga` requires Pilot field — see [`docs/editions/bank.yaml`](../../docs/editions/bank.yaml).

**Scope boundary:** [`Bank-Capability-Inventory.md`](../../docs/acceptance/Bank-Capability-Inventory.md) · Full CBS program [`Bank-Full-CBS-Roadmap.md`](../../docs/acceptance/Bank-Full-CBS-Roadmap.md). This track advances live/cert DECLARED rows (YC-E). Product-depth XO/FC waves are separate.

## Tracks (YC-E certification — ⏸ until sandbox creds)

| Wave | Track | Inventory IDs (examples) | Status |
|------|--------|---------------------------|--------|
| YC-E1 | Live payment rails | CAP-PAY-RAIL, CAP-PAY-ISO | ⏸ no partner sandbox creds |
| YC-E2 | Live cards gateway | CAP-CARD-LIVE | ⏸ |
| YC-E3 | Live ASAN/SİMA + MDM trust | CAP-DBO-ASAN, CAP-CORE-CIF | ⏸ |
| YC-E4 | Live AKB + certified ECL | CAP-LN-AKB, CAP-LN-ECL, CAP-RSK-CERT | ⏸ |
| YC-E5 | FMN/CBAR live + sanctions | CAP-REG-CBAR, CAP-AML-FEED | ⏸ (sanctions may stay BLOCKED) |
| YC-E6 | Pentest + HA EOD prod | CAP-NFR-HA | ⏸ |
| YC-E7 | Pilot field + `pilot_ready` / edition bump | CAP-NFR-FIELD | ⏸ |

Do **not** mark COVERAGE SHIPPED for live rails/cards/ASAN while ⏸.  
Do **not** narrate YC-E completion as product ga — Full CBS product-depth waves (FC/XO) must also reach IN; `pilot_ready` requires E7 field evidence.

## Adapter paths (YC-E scaffold)

| Track | Env | Implementation |
|-------|-----|----------------|
| YC-E1 rails | `BANK_RAIL_MODE`, `BANK_RAIL_BASE_URL`, `BANK_RAIL_API_KEY` | `era-bank-core/apps/api/src/modules/payments/stub-rail.adapter.ts` |
| YC-E2 cards | `BANK_CARDS_MODE`, `BANK_CARDS_BASE_URL`, `BANK_CARDS_API_KEY` | `era-bank-core/apps/api/src/modules/cards/gateway/mock-azericard.gateway.ts` |
| YC-E3 ASAN | `BANK_ASAN_MODE`, `BANK_ASAN_BASE_URL`, `BANK_ASAN_API_KEY` | `era-bank-core/apps/api/src/integration/asan-sima-stub.adapter.ts` |
| YC-E4 AKB | `BANK_BUREAU_MODE`, `BANK_AKB_BASE_URL`, `BANK_AKB_API_KEY` | `era-bank-core/apps/api/src/modules/loans/bureau.adapter.ts` |
| YC-E5 CBAR | `BANK_CBAR_MODE`, `BANK_CBAR_BASE_URL`, `BANK_CBAR_API_KEY` | `era-bank-core/apps/api/src/modules/regreporting/regreporting.service.ts` |
| Mode helpers | — | `era-bank-core/apps/api/src/integration/live-mode.ts` |
| Contract tests | — | `era-bank-core/apps/api/__tests__/yc-e-mode-flags.spec.ts` |
| Signoff artifact | — | [`reports/bank-yc-e-adapters-signoff.md`](../../reports/bank-yc-e-adapters-signoff.md) |

## Exit criteria

- [ ] Live rail ACK for at least one outbound payment in staging
- [ ] FMN file accepted by regulator test endpoint (or documented waiver)
- [ ] Pentest report with no critical open items
- [ ] ADR [era-bank-core.md](../../docs/adr/era-bank-core.md) bumped to **Accepted (GA implemented)** only with Pilot field + edition yaml
- [ ] Capability Inventory DECLARED→IN/SHIPPED rows updated in the same change

## References

- [SECURITY-CHECKLIST.md](../../era-bank-core/doc/SECURITY-CHECKLIST.md)
- [UAT-SMOKE-FULL.md](../../era-bank-core/doc/UAT-SMOKE-FULL.md)
- [Bank-Acceptance-System.md](../../docs/acceptance/Bank-Acceptance-System.md)
