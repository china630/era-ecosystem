# CRM — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Crm-Implementation-Matrix.md`](./Crm-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/crm.yaml`](../editions/crm.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

**Closeout (2026-11-18 selections/warranty):** CRM-SEL-01 / CRM-WAR-01 API/SCREEN; AC-CRM-SEL / AC-CRM-WAR 🟡 out of BE rollup. Gate / BE ✅ / UI 🟡 / Demo 🟡 / Pilot / Sell unchanged. Edition `mvp` untouched. `era-readiness-matrix` N/A.

**Closeout (2026-11-18 product UI):** ModalShell add warranty / selection item + empty states — still UI 🟡 SCREEN (not SHOW). Demo/Pilot/Sell/edition untouched.

**Closeout (2026-11-10 access denied):** A missing screen grant opens `/access-denied`. Scaffold stays 🟡. Gate / BE / UI / Demo / Pilot / Sell unchanged. Edition yaml untouched.

**Closeout (2026-11-10 entity grid):** `/admin/access` is an entity × View / Change / Operate / Admin grid. Catalog v2 copies a read key once from the write key; GET uses the read key. RBAC row stays API / SCREEN. Scaffold stays 🟡. Gate / BE / UI / Demo / Pilot / Sell unchanged. Edition yaml untouched.

**Closeout (2026-08-18 Green Scaffold BE Wave 8):** Scaffold BE ✅ (PIPE+PARTY; WA excl. from rollup like Hotel INT). UI / Demo / Pilot / Sell unchanged — do **not** claim GA; edition stays `mvp`.

**Closeout (2026-11-25 integrations wave start):** ADR split to `docs/adr/crm/`; kit + admin `/admin/integrations` + inbox conversations UI landed as SCREEN/API. AC-CRM-INT/INBOX/TEL/TASK/… stay 🟡 out of BE rollup. Gate / BE ✅ / UI 🟡 / Demo 🟡 / Pilot / Sell **unchanged**. Edition `mvp` untouched — do **not** claim GA. Engineering API refresh → `era-readiness-matrix` when DELIVERY % moves.

**Closeout (2026-11-25 second-pass):** Unsorted Accept/Link/Reject + scope on listLeads + activity feed + convert settings wired. Still UI 🟡 SCREEN (not SHOW). AC-CRM-UNSORT/SCOPE/ACT stay 🟡 out of BE rollup (no negatives/UAT). Gate / BE ✅ / UI 🟡 / Demo 🟡 / Pilot / Sell **unchanged**. Edition `mvp` untouched.

**Closeout (2026-11-25 security+adapters):** Encrypted webhook secrets, integrations RBAC, rawBody HMAC path, outbox worker, live TG/WA/IG/telephony adapters, convert defaults opt-in. Still UI 🟡 SCREEN (not SHOW / not SHIPPED). AC-CRM-INT/INBOX/TEL stay 🟡 out of BE rollup (no negatives/UAT). Gate / BE ✅ / UI 🟡 / Demo 🟡 / Pilot / Sell **unchanged**. Edition `mvp` untouched — do **not** claim GA.

**Closeout (2026-11-25 P0 deepen T-I05/12/13/20/21 + E4):** Inbound BullMQ, Meta OAuth UI, email IMAP/SMTP, asterisk Originate + extensions map, ICS feed. Still UI 🟡 SCREEN (not SHOW / not SHIPPED). AC-CRM-INT/INBOX/TEL/TASK stay 🟡 out of BE rollup (no negatives/UAT). Gate / BE ✅ / UI 🟡 / Demo 🟡 / Pilot / Sell **unchanged**. Edition `mvp` untouched — do **not** claim GA.

**Closeout (2026-11-25 I-3 P1 slice T-I22/23/25/29 + P1-1):** Viber/VK/MAX + FB Messenger + Meta Lead Ads + Megafon/Gravitel/MTS VATS; outbound webhooks + tenant API keys; Digital Pipeline lite. Still UI 🟡 SCREEN (not SHOW / not SHIPPED). AC-CRM-INT/INBOX/TEL/TASK/PIPECFG stay 🟡 out of BE rollup (no negatives/UAT). Gate / BE ✅ / UI 🟡 / Demo 🟡 / Pilot / Sell **unchanged**. Edition `mvp` untouched — do **not** claim GA.

**Closeout (2026-11-25 I-4 + product P1):** Green-API risk gate, OK/WeChat/LINE, Meta CAPI (+ WON fire), GA4 MP, Twilio SMS, 3CX, `era_externalcall`; Contact/Company + merge + custom fields/tags + SalesGoal APIs; thin SCREEN `/parties`, lead merge, goals on `/reports`. Still UI 🟡 SCREEN (not SHOW / not SHIPPED). AC-CRM-INT/ENT/MERGE/CF/KPI stay 🟡 out of BE rollup. Gate / BE ✅ / UI 🟡 / Demo 🟡 / Pilot / Sell **unchanged**. Edition `mvp` untouched — do **not** claim GA.

**Closeout (2026-11-25 CF UI + MSM honesty):** `/admin/custom-fields` + lead card custom values/tags → CRM-CF-01 SCREEN. MSM.az stays catalog **blocked** until HTTP/XML spec (info@msm.az). Gate / BE ✅ / UI 🟡 / Demo 🟡 / Pilot / Sell **unchanged**. Edition `mvp` untouched.

**Closeout (2026-11-25 plan waves 0→I-4 gaps):** mega-doc stub; KEK rotate; E5 payment UI; bot-lite; PWA; clinic pipeline template; Collabo blocked; P2 CPaaS catalog. Still UI 🟡 SCREEN. AC PAY/BOT/PWA 🟡 out of BE rollup. Gate / BE ✅ / UI 🟡 / Demo 🟡 / Pilot / Sell **unchanged**. Edition `mvp` untouched — do **not** claim GA.

**Closeout checklist (2026-11-25 Acceptance Standard — vendor-06 second-pass):** COVERAGE INT/INBOX/TEL notes (prefetch/respond + duplicate ACK, anti-oracle hooks, `call.recording`+`fetchRecording`, extensions+i18n) — API/SCREEN not SHIPPED; IM AC-CRM-INT/TEL/INBOX 🟡 (no Scaffold ✅); PRM Gate ✅ · BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]`/`[ ]` · Sell/`mvp` unchanged; Sprint `S-INT-WAVE` [~]; `crm.yaml` untouched; MSM/Collabo/Apple blocked; `check:acceptance` + `:strict` PASS; engineering DELIVERY **31/34=91%** → READINESS N/A (not sell; % unchanged).

**Closeout checklist (2026-11-25 Acceptance Standard — vendor-06 W0–W7):** COVERAGE INT/INBOX/TEL/TASK/PIPE/RPT notes (kit K1–K8, AZ+RF adapters, challenge anti-oracle, PBX/mail deepen) — API/SCREEN not SHIPPED; IM AC-CRM-INT/INBOX/TEL/… 🟡; PRM Gate ✅ · BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]`/`[ ]` · Sell/`mvp` unchanged; Sprint `S-INT-WAVE` [~]; `crm.yaml` untouched; MSM/Collabo/Apple still blocked; keys/UAT later; engineering DELIVERY % → READINESS only if moved (not sell).

**Closeout checklist (2026-11-25 Acceptance Standard — audit v4 second-pass):** COVERAGE PIPE/SCOPE notes (card↔stageId, create default pipeline, pipelines GET LEADS_READ, SSE RINGING scoped) — API/SCREEN not SHIPPED; IM AC-CRM-PIPECFG/SCOPE 🟡; PRM Gate ✅ · BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]`/`[ ]` · Sell/`mvp` unchanged; Sprint `S-INT-WAVE` [~]; `crm.yaml` untouched; `check:acceptance` + `:strict` PASS; engineering DELIVERY **31/34=91%** → READINESS N/A (not sell).

**Closeout checklist (2026-11-25 Acceptance Standard — audit v4 W0–W6):** COVERAGE SCOPE/TASK/PIPE/INBOX/INT/RPT updated (complete scope, captcha harden, kanban↔PipelineStage + rules, orch WA v21, Conversation dual-read, catalog BLOCKED honesty) — API/SCREEN not SHIPPED; IM AC-* 🟡; PRM Gate ✅ · BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]`/`[ ]` · Sell/`mvp` unchanged; Sprint `S-INT-WAVE` [~]; `crm.yaml` untouched; `check:acceptance` + `:strict` PASS; engineering DELIVERY % → READINESS only if moved (not sell).

**Closeout checklist (2026-11-25 Acceptance Standard — product depth P0-3/5/6 + P1-5):** COVERAGE TASK/PIPE/RPT/INBOX actors updated (home tasks, `/admin/pipelines`, dwell+first-response, captcha+RL) — API/SCREEN not SHIPPED; IM AC-CRM-TASK/PIPECFG/RPT/INBOX 🟡 (no Scaffold ✅ without field UAT); PRM Gate ✅ · BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]`/`[ ]` · Sell/`mvp` unchanged; Sprint `S-INT-WAVE` [~]; `crm.yaml` untouched; `check:acceptance` + `:strict` PASS; engineering DELIVERY **31/34=91%** → READINESS_MATRIX (not sell; % unchanged).

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **CRM** | ✅ | ✅ | 🟡 | 🟡 | [ ] | [ ] | `mvp` | do not claim GA — pilot open |

---

## UI (short)

**UI class rollup:** SCREEN — [UI-COVERAGE-BOARD.md](./UI-COVERAGE-BOARD.md). This table is sell/show; «is there a screen?» lives on the board.

| Surface | Path | Level |
|---------|------|-------|
| Pipeline / leads | `CRM UI` | 🟡 |
| Home tasks | `/` today/overdue widget | 🟡 SCREEN (CRM-TASK-01; not SHOW) |
| Pipelines admin | `/admin/pipelines` | 🟡 SCREEN (CRM-PIPE-01; not SHOW) |
| Unsorted queue | `/unsorted` Accept/Link/Reject | 🟡 SCREEN (CRM-UNSORT-01; not SHOW) |
| Visits / inbox | `visits + inbox` (3-col conversations) | 🟡 SCREEN (CRM-INBOX-01; not SHOW) |
| Integrations admin | `/admin/integrations` (+ OAuth callback, extensions) | 🟡 SCREEN (CRM-INT-01; not SHOW) |
| Reports | `/reports` (+ dwell / first response + goals) | 🟡 SCREEN (CRM-RPT-01 / CRM-KPI-01; not SHOW) |
| Companies & contacts | `/parties` | 🟡 SCREEN (CRM-ENT-01; not SHOW) |
| Custom fields | `/admin/custom-fields` + lead card | 🟡 SCREEN (CRM-CF-01; not SHOW) |
| Payment status E5 | `/leads/[id]` payment block | 🟡 SCREEN (CRM-PAY-01; not SHOW) |
| Lead merge | `/leads/[id]` merge block | 🟡 SCREEN (CRM-MERGE-01; not SHOW) |
| Lead timeline | `/leads/[id]` activity feed | 🟡 SCREEN (CRM-ACT-01; not SHOW) |
| Convert settings | `/admin/settings` side-effect flags | 🟡 SCREEN (P1-8; not SHOW) |
| Selections / warranty | `/leads/[id]` ModalShell forms + empty states | 🟡 SCREEN (CRM-SEL-01 / CRM-WAR-01; not SHOW) |
| Access matrix | `/admin/access` | 🟡 SCREEN (CRM-RBAC-01; not SHOW) |

Create-lead and admin import now follow the modal CRUD playbook; sell/show stays 🟡 until live sign-off.

**Having routes ≠ UI ready for sell.** Demo/TE stays 🟡 until live sign-off.

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) | [ ] | `era-crm/doc/UAT-SMOKE.md` |
| Field checklist | [ ] | — |
| Partner / customer sign-off | [ ] | — |

---

## Sell / show rules

- Edition column copies `docs/editions/crm.yaml`.
- Sell text must not contradict the worst layer above.
- Forbidden: «ready» / «GA» while Pilot field open or Demo ❌.
- Forbidden: «SHARED / multi-tenant CRM SaaS pool» — AC-CRM-TENANT 🟡 (schema+filter ≠ live pool); stays out of BE rollup.
