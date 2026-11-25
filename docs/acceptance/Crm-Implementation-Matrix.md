# CRM — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Crm-Product-Readiness-Matrix.md`](./Crm-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Green Scaffold BE wave 3 — `__tests__/crm-pipe-negative.spec.ts`, `crm-party-negative.spec.ts`.  
**Wave 8 (2026-08-18):** AC-CRM-WA excluded from Scaffold BE rollup (Hotel INT pattern); stays Scaffold 🟡 / External ⏸.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-CRM-PIPE | Pipeline + lead score + automation | ✅ | [ ] | `__tests__/crm-pipe-negative.spec.ts` | Negative: module gate 403; assign grant deny (`api:leads.assign`); stage party gate |
| AC-CRM-PARTY | Party profile / FIN-MDM / Finance CP | ✅ | [ ] | `__tests__/crm-party-negative.spec.ts` | Negative: module gate 403; VÖEN/company/phone; import deny |
| AC-CRM-WA | WhatsApp Business API stage hook | 🟡 | [ ] | Orch + CRM hook | External ⏸ — vendor WhatsApp; **excluded from Scaffold BE rollup** (Hotel INT) |
| AC-CRM-TENANT | SHARED pool: `organizationId` on ops rows + composite uniques | 🟡 | [ ] | CP-TENANT-01; kit tenant extension | **Excluded from Scaffold BE rollup.** Schema + filter landed; not Scaffold ✅ (no live SHARED pool / field two-org UAT) |
| AC-CRM-RBAC | Configurable role×permission matrix + custom roles (Variant A) | 🟡 | [ ] | `crm-rbac` + `crm-rbac-doors` + page/API inventory + role-name grep; ADR crm-domain-permissions-and-rbac; `/admin/access` entity grid, catalog v2, clone + assign | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence |
| AC-CRM-SEL | SelectionPackage + items (post-sale) | 🟡 | [ ] | CRM-SEL-01; convert seeds OPEN package; `/leads/[id]` ModalShell add item | **Out of BE rollup.** SKU `crm_selections`; playbook SCREEN; not SHIPPED. |
| AC-CRM-WAR | WarrantyCase on lead | 🟡 | [ ] | CRM-WAR-01; `/leads/[id]` ModalShell; create asserts lead scope | **Out of BE rollup.** SKU `crm_warranty`; SCREEN; not SHIPPED. |
| AC-CRM-INT | Integrations kit + admin connections | 🟡 | [ ] | CRM-INT-01; kit K1–K8; prefetch/respond + duplicate ACK; P2 blocked; orch WA v21 | **Out of BE rollup.** API/SCREEN; no Scaffold ✅ without PRD negatives + UAT |
| AC-CRM-ENT | Contact / Company | 🟡 | [ ] | CRM-ENT-01; `/api/companies|contacts` + `/parties` | **Out of BE rollup.** SCREEN; UAT open |
| AC-CRM-MERGE | Lead merge | 🟡 | [ ] | CRM-MERGE-01; merge + both ids in scope + lead card | **Out of BE rollup.** SCREEN; UAT open — not Scaffold ✅ |
| AC-CRM-CF | Custom fields + tags | 🟡 | [ ] | CRM-CF-01; `/admin/custom-fields` + lead card | **Out of BE rollup.** SCREEN; UAT open; MSM.az adapter blocked on vendor spec |
| AC-CRM-KPI | Sales goals plan-fact | 🟡 | [ ] | CRM-KPI-01; SalesGoal + `/reports` | **Out of BE rollup.** SCREEN; UAT open |
| AC-CRM-PAY | Payment status E5 | 🟡 | [ ] | CRM-PAY-01; lead card + `/api/leads/:id/payment` | **Out of BE rollup.** SCREEN; no PSP in CRM |
| AC-CRM-BOT | Bot lite auto-reply | 🟡 | [ ] | CRM-BOT-01; PipelineRule `autoReply` | **Out of BE rollup.** API; no visual builder |
| AC-CRM-PWA | Field PWA | 🟡 | [ ] | CRM-PWA-01; manifest + SW | **Out of BE rollup.** SCREEN shell |
| AC-CRM-INBOX | Bidirectional inbox | 🟡 | [ ] | CRM-INBOX-01; orphans gated; challenge anti-oracle; channel-strict connect | **Out of BE rollup.** API/SCREEN; Meta sandbox UAT open — not Scaffold ✅ |
| AC-CRM-TEL | Telephony | 🟡 | [ ] | CRM-TEL-01; call.recording + fetchRecording HTTPS; VirtualATS/Gravitel/Mango/Sipuni/VATS; PBX | **Out of BE rollup.** API/SCREEN; keys/field UAT open — not Scaffold ✅ |
| AC-CRM-TASK | Tasks | 🟡 | [ ] | CRM-TASK-01; home + complete scope + orphan list assignee-gated + ICS | **Out of BE rollup.** SCREEN home; UAT open — not Scaffold ✅ |
| AC-CRM-PIPECFG | Configurable pipelines/stages + Digital Pipeline lite | 🟡 | [ ] | CRM-PIPE-01; board+card stageId + party gate; create default pipe; GET LEADS_READ | **Out of BE rollup.** SCREEN admin/board/card; UAT open — not Scaffold ✅ |
| AC-CRM-UNSORT | Unsorted inbound leads | 🟡 | [ ] | CRM-UNSORT-01; Accept/Link/Reject; Link target scoped | **Out of BE rollup.** API+SCREEN; UAT open — not Scaffold ✅ |
| AC-CRM-RPT | Funnel reports | 🟡 | [ ] | CRM-RPT-01; history + dwell + first-response; optional `pipelineId` | **Out of BE rollup.** API/SCREEN; Demo open — not Scaffold ✅ |
| AC-CRM-SCOPE | Record-level lead scope | 🟡 | [ ] | CRM-SCOPE-01; export≠all; orphans; complete; SSE RINGING scoped | **Out of BE rollup.** Scaffold ✅ blocked until PRD negatives + field UAT; stay 🟡 |
| AC-CRM-ACT | Activity timeline | 🟡 | [ ] | CRM-ACT-01; writers + lead-card feed | **Out of BE rollup.** Feed on `/leads/[id]`; UAT open |

**Edition / wave rollup (BE only)** = worst(PIPE, PARTY) → **✅**.  
AC-CRM-WA remains 🟡 and is **out of Scaffold BE rollup** until vendor WhatsApp leaves External. Do **not** mark WA Scaffold ✅.  
AC-CRM-TENANT is 🟡 (schema+filter) and stays **out of Scaffold BE rollup** until a live SHARED pool + field isolation UAT.  
AC-CRM-RBAC is 🟡 (Variant A landed; field UAT open) and stays **out of Scaffold BE rollup**.  
AC-CRM-SEL / AC-CRM-WAR are 🟡 and **out of Scaffold BE rollup**.  
AC-CRM-INT / INBOX / TEL / TASK / PIPECFG / UNSORT / RPT / SCOPE / ACT / ENT / MERGE / CF / KPI / PAY / BOT / PWA are 🟡 **out of Scaffold BE rollup** (integrations + product P1/P2 wave — API/SCREEN landed, no negatives/Pilot yet).  
Do **not** flip any of these to Scaffold ✅ without PRD wording + negative path. Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-CRM-WA | WhatsApp Business API live hook | External ⏸ | **Excluded from Scaffold BE rollup** (Wave 8; Hotel INT) |
| AC-CRM-TENANT | Live SHARED pool + field isolation UAT | Out of BE rollup | Schema+filter only |
| AC-CRM-RBAC | Field UAT / SHOW | Out of BE rollup | SCREEN until signoff |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-crm/__tests__/crm-pipe-negative.spec.ts` | AC-CRM-PIPE |
| `era-crm/__tests__/crm-party-negative.spec.ts` | AC-CRM-PARTY |
| `era-crm/__tests__/crm-rbac.spec.ts` | AC-CRM-RBAC |
| `era-crm/__tests__/crm-rbac-doors.spec.ts` | AC-CRM-RBAC |
| `era-crm/__tests__/crm-rbac-inventory.spec.ts` | AC-CRM-RBAC |
| `era-crm/__tests__/crm-rbac-role-name-grep.spec.ts` | AC-CRM-RBAC |
