# ERA Acceptance — product index

**Canon:** [`docs/products/ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Config:** [`kit-config.yaml`](../../kit-config.yaml)  
**Editions SSOT:** [`docs/editions/`](../editions/)  
**Portable kit:** [`acceptance-kit/`](../../acceptance-kit/)

## Request routing

| User asks | Answer from |
|-----------|-------------|
| «можно показывать / пилот / продавать / Product Readiness» (любой продукт) | `*-Product-Readiness-Matrix.md` below |
| «готовность банка / модуля banking_*» (слои Gate/BE/UI/Demo/Pilot) | [`Bank-Product-Readiness-Matrix.md`](./Bank-Product-Readiness-Matrix.md) — **Line summary** + **Modules × layers** |
| Scaffold / AC / backend matrix | `*-Implementation-Matrix.md` |
| «полный банк / чего нет / OUT scope» | [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md) |
| «BE Lite / Deep bank API» | [`Bank-BE-Roadmap.md`](./Bank-BE-Roadmap.md) |
| «матрица готовности API / §4 / consumer / обнови READINESS» | [`docs/READINESS_MATRIX.md`](../READINESS_MATRIX.md) + skill `era-readiness-matrix` |

**Forbidden:** answering sell/show from COVERAGE SHIPPED or DELIVERY % alone.  
**Forbidden:** treating Bank AC all ✅ as «полная коммерческая АБС» — check Capability Inventory OUT.

## Closeout (5 steps)

1. Update COVERAGE_MATRIX row(s) for touched capabilities.  
2. Update Implementation-Matrix (Scaffold ✅ only per canon §3.2).  
3. Update Product-Readiness-Matrix (rollup = worst layers).  
4. Sync Sprint-Index / editions yaml if gate or sell claim changed.  
5. `npm run check:acceptance` (strict before PR: `npm run check:acceptance:strict`).

## Product lines

| Line | Status | Acceptance-System | Readiness | Implementation |
|------|--------|-------------------|-----------|----------------|
| Platform | full | [Platform](./Platform-Acceptance-System.md) | [PRM](./Platform-Product-Readiness-Matrix.md) | [IM](./Platform-Implementation-Matrix.md) |
| Clinic | full | [Clinic](./Clinic-Acceptance-System.md) | [PRM](./Clinic-Product-Readiness-Matrix.md) | [IM](./Clinic-Implementation-Matrix.md) |
| Hotel | full | [Hotel](./Hotel-Acceptance-System.md) | [PRM](./Hotel-Product-Readiness-Matrix.md) | [IM](./Hotel-Implementation-Matrix.md) |
| Finance | full | [Finance](./Finance-Acceptance-System.md) | [PRM](./Finance-Product-Readiness-Matrix.md) | [IM](./Finance-Implementation-Matrix.md) |
| Bank | full | [Bank](./Bank-Acceptance-System.md) | [PRM](./Bank-Product-Readiness-Matrix.md) | [IM](./Bank-Implementation-Matrix.md) · [Capability Inventory](./Bank-Capability-Inventory.md) |
| Bank DBO | full | [Bank-DBO](./Bank-DBO-Acceptance-System.md) | [PRM](./Bank-DBO-Product-Readiness-Matrix.md) | [IM](./Bank-DBO-Implementation-Matrix.md) (parent inventory) |
| F&B | full | [Fnb](./Fnb-Acceptance-System.md) | [PRM](./Fnb-Product-Readiness-Matrix.md) | [IM](./Fnb-Implementation-Matrix.md) |
| Retail | full | [Retail](./Retail-Acceptance-System.md) | [PRM](./Retail-Product-Readiness-Matrix.md) | [IM](./Retail-Implementation-Matrix.md) |
| CRM | full | [Crm](./Crm-Acceptance-System.md) | [PRM](./Crm-Product-Readiness-Matrix.md) | [IM](./Crm-Implementation-Matrix.md) |
| Logistics | full | [Logistics](./Logistics-Acceptance-System.md) | [PRM](./Logistics-Product-Readiness-Matrix.md) | [IM](./Logistics-Implementation-Matrix.md) |
| Wholesale | full | [Wholesale](./Wholesale-Acceptance-System.md) | [PRM](./Wholesale-Product-Readiness-Matrix.md) | [IM](./Wholesale-Implementation-Matrix.md) |
| Construction | full | [Construction](./Construction-Acceptance-System.md) | [PRM](./Construction-Product-Readiness-Matrix.md) | [IM](./Construction-Implementation-Matrix.md) |
| Auto | full | [Auto](./Auto-Acceptance-System.md) | [PRM](./Auto-Product-Readiness-Matrix.md) | [IM](./Auto-Implementation-Matrix.md) |
| Data Hub | full | [Data-Hub](./Data-Hub-Acceptance-System.md) | [PRM](./Data-Hub-Product-Readiness-Matrix.md) | [IM](./Data-Hub-Implementation-Matrix.md) |

## Fact sources (do not duplicate)

- Capabilities (Doc/API/UI actors): [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)  
- Bank scope boundary (IN/PARTIAL/DECLARED/OUT): [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md)  
- Engineering API %: [`READINESS_MATRIX.md`](../READINESS_MATRIX.md)  
- Checklists: `era-*/doc/DELIVERY*.md`  
- Lab smoke: `era-*/doc/UAT-SMOKE.md`  
- Gate artifacts: [`reports/`](../../reports/)

## Related

- Security & Hygiene program (AuthZ / SAST / DAST / remediation waves): [`SECURITY_HYGIENE_PROGRAM.md`](../SECURITY_HYGIENE_PROGRAM.md)
