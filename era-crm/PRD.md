# ERA CRM Field — Product Requirements Document (PRD)

> Полевой CRM и pre-sale воронка (лиды, визиты, WhatsApp/Instagram). **Не** заменяет CRM контрагентов и отправку инвойсов в Finance.  
> TZ: [TZ.md](./TZ.md) · DELIVERY: [doc/DELIVERY-CRM.md](./doc/DELIVERY-CRM.md)

| Параметр | Значение |
|----------|----------|
| **Продукт** | ERA CRM Field (`era-crm`) |
| **Entitlement** | `industry_crm` |
| **Host** | `crm.era-365.online` (3303) |
| **Аудитория** | SMB AZ: продажи через мессенджеры, выездные визиты, малые команды |

---

## §1. Vision

### 1.1. Проблема

Продажи идут в WhatsApp/Instagram, а «официальный» CRM и счета — в ERP. Менеджеры дублируют клиентов; бухгалтерия не видит квалифицированный лид до выставления счёта.

### 1.2. Решение

**ERA CRM Field** — лёгкий operational CRM: лид → квалификация → визит → конверсия. При конверсии — событие в orchestrator; **Finance** создаёт/обновляет контрагента и счёт, отправляет WA-invoice если включено.

### 1.3. Critical boundary (read first)

| ERA CRM Field | era-finance-core |
|---------------|------------------|
| Лиды, стадии, визиты, чат pre-sale | **Counterparty MDM**, VÖEN, договоры |
| История переписки (операционная) | **WhatsApp invoice delivery** |
| `SATELLITE_CRM_LEAD_CONVERTED` | Draft invoice + CRM card |

Детали: [doc/clone-spec/01-finance-boundary.md](./doc/clone-spec/01-finance-boundary.md)

### 1.4. Out-of-scope v1

- Полноценный helpdesk / ticket system
- Массовые рассылки WA (marketing) — compliance risk
- Дублирование Finance `/crm` counterparty screens
- Склад, оплаты, GL

---

## §2. Benchmark reference

| Бенчмарк | Что заимствуем |
|----------|----------------|
| **Bitrix24** (leads + Open Channels) | Pipeline stages, lead card, messenger inbox UX |
| **Kommo (amoCRM)** | WhatsApp-first sales, quick lead create |
| **Respond.io** | Unified inbox, channel tags |
| **HubSpot** (lite) | Lead status model, activity timeline |

**Не копируем:** Bitrix automation constructor, amo billing complexity, full marketing suite.

---

## §3. Personas & roles

> RBAC: [docs/SATELLITE_DOCUMENTATION.md](../docs/SATELLITE_DOCUMENTATION.md) § Identity & RBAC.

| Роль | Код | Права |
|------|-----|-------|
| Владелец бизнеса | `BUSINESS_OWNER` | Маппинг `OWNER`/`DIRECTOR`; биллинг — Finance; воронка KPI |
| Sales agent | `SALES_AGENT` | Leads, chats, visits own |
| Team lead | `SALES_LEAD` | Reassign, pipeline config |
| Field rep | `FIELD_REP` | Visits, check-in |
| Read-only auditor | `SATELLITE_OPERATOR` | SSO read |

---

## §4. Modules

| ID | Module | Benchmark | Status | Finance |
|----|--------|-----------|--------|---------|
| M0 | Shell, SSO, health | — | **DONE** | — |
| M1 | Lead pipeline | Kommo pipeline | **DONE** | — |
| M2 | Lead card & activities | Bitrix timeline | **DONE** | — |
| M3 | Channel inbox (WA/IG stub) | Respond.io | **DONE** | — |
| M4 | Visit log & geo stub | — | **DONE** | — |
| M5 | Convert lead | Kommo «won» | **DONE** | `SATELLITE_CRM_LEAD_CONVERTED` |
| M6 | Finance handoff UI | — | **DONE** | Link to Finance counterparty |
| M7 | WA Business API live | Respond.io | **DONE** (v2.0) | Finance sends invoice |
| M4 (extend) | Visit geo check-in | Field GPS stub | **MVP** | `Visit.latitude` / `longitude` on `/visits` |
| **M8** | **Next-contact reminder** | HubSpot tasks | **MVP** | `Lead.nextContactAt` + follow-up API |
| M9 | Lead scoring / SLA timers | Kommo | **MVP** | `POST /api/leads/:id/score` |
| M10 | Pipeline automation rules | Bitrix | **DONE** | — |
| M11 | Lead party profile | — | **DONE (v3.0)** | M15 Finance handoff |
| M12 | Lead card page | Bitrix | **DONE (v3.0)** | — |
| M13 | Create lead UI | Kommo | **DONE (v3.0)** | — |
| M14 | Prospect import | — | **DONE (v3.0)** | e-taxes CSV |
| M15 | Finance auto-counterparty | — | **DONE (v3.0)** | extended event |
| M16 | Individual FIN (MDM) | — | **DONE (v3.0)** | `globalPersonId` |

См. [MODULES_CATALOG § roadmap](../docs/MODULES_CATALOG.md#industry-module-roadmap) · [PRODUCT_VERSIONING](../docs/PRODUCT_VERSIONING.md).

---

## §5. User stories

| ID | Как | Хочу | Критерии | Phase |
|----|-----|------|----------|-------|
| C-01 | Agent | Создать лид из WA | channel=whatsapp, stage NEW | C1 |
| C-02 | Agent | Перевести лид по стадиям | Stage history | C1 |
| C-03 | Field rep | Записать визит | visit date, notes | C1 |
| C-04 | Agent | Конвертировать лид | Event with leadId; optional counterpartyId | C1 |
| C-05 | Finance user | Увидеть счёт после конверсии | Invoice only in Finance UI | C1 |
| C-06 | Lead | Назначить лида агенту | ownerId | C2 |
| C-07 | Agent | Прикрепить estimatedAmount | In event payload | C1 |

---

## §6. Integrations

| Event | When | Finance |
|-------|------|---------|
| `SATELLITE_CRM_LEAD_CONVERTED` | Lead → Won | Link/create counterparty; optional draft invoice |
| `SATELLITE_CRM_VISIT_LOGGED` | Field visit logged | Activity log stub in Finance worker |

---

## §7. Release phases

| Phase | Scope |
|-------|--------|
| **C0** | Scaffold, SSO, dispatch stub (done) |
| **C1** | Pipeline + convert + Finance E2E |
| **C2** | Visits, assignment, inbox stub |
| **C3** | Live WA Business API via Finance bridge |

---

## §8. Changelog

| Date | Note |
|------|------|
| 2026-05-23 | Scaffold |
| 2026-05-24 | PRD v1.0 + explicit Finance boundary |
| 2026-05-25 | SP1 C2: visits API + `SATELLITE_CRM_VISIT_LOGGED` dispatch |
| 2026-05-25 | SP1 C2 SW2: visit UI, agent assignment, inbox stub (WA/IG metadata) |
| 2026-05-28 | Enrichment W1: M4 geo, M8 next-contact |
| 2026-05-28 | Enrichment W2: M9–M10 |
| 2026-07-02 | §9 **v3.0 roadmap** — party model, import, Finance auto-CP; ADR [crm-lead-party-model-and-prospect-import](../docs/adr/crm-lead-party-model-and-prospect-import.md) |
| 2026-07-02 | §9.8 Bitrix backlog M17–M30 — deferred waves; ADR §8 |

---

## §9. Roadmap — v3.0 (party model, partners, import)

> **PRD vs ADR:** this section is **product scope** (what users get, acceptance). Architecture, event contract, and Finance handoff rules live in [docs/adr/crm-lead-party-model-and-prospect-import.md](../docs/adr/crm-lead-party-model-and-prospect-import.md).  
> **Status:** SHIPPED (2026-07-02) — DELIVERY § Planned v3.0 `[x]`; UAT-SMOKE § C5–C8.

### 9.1. Problem (gap after v2.0)

- VÖEN lookup on `/leads` is **not saved** on the lead.
- No **party type** (individual vs legal entity); no FIN path for individuals.
- No **create-lead form** on `/leads` (API-only + inbox prefill).
- Convert event does not carry party data → Finance does **not** auto-create counterparty.
- Enriched registry in `data/legal-entities/` has no CRM import path.
- Founder **partner** prospects are not distinguishable from customer leads.

### 9.2. Vision (v3.0)

One operational pipeline for **customers and partner prospects** (physical + legal), AZ-compliant identifiers, bulk load from e-taxes-enriched CSV/Excel, clean handoff to Finance on WON.

### 9.3. Modules (planned)

| ID | Module | Status | Notes |
|----|--------|--------|-------|
| **M11** | Lead party profile | **DONE (v3.0)** | `partyKind`, `taxId`, `companyName`, phone, email, `activitySector`, `prospectType` |
| **M12** | Lead card page | **DONE (v3.0)** | `/leads/[id]` — party block, stage, follow-up, convert |
| **M13** | Create lead UI | **DONE (v3.0)** | Modal/form on `/leads`; wire existing `VoenLookupField` |
| **M14** | Prospect import | **DONE (v3.0)** | CSV/XLSX upload; map `data/legal-entities` columns |
| **M15** | Finance auto-counterparty | **DONE (v3.0)** | Extended convert event → Finance find-or-create CP |
| **M16** | Individual FIN (MDM) | **DONE (v3.0)** | Optional FIN lookup; `globalPersonId` on lead |
| M3 ext | Inbox 2-way (WA live thread) | **DEFERRED (v3.1)** | M17 — ADR §8 |
| M2 ext | Activity timeline (calls, files) | **DEFERRED (v3.1)** | M18 — ADR §8 |
| — | Orchestrator `Partner` on convert | **DEFERRED (v3.1)** | M20 — ADR §8 |

### 9.8. Bitrix24 backlog (deferred — much later)

Full table and never-copy list: [ADR §8](../docs/adr/crm-lead-party-model-and-prospect-import.md#8-bitrix24-benchmark-backlog-deferred).

| Wave | Modules | Headline |
|------|---------|----------|
| **v3.1** | M17–M21 | Inbox 2-way, rich timeline, lead merge, Partner hook, import column mapper |
| **v4.0** | M22–M28 | Funnel KPI, Contact/Company split, custom fields, quotes, calendar, telephony/email |
| **v5.0+** | M29–M30 | Field-sales mobile, field-level ACL |
| **Never** | — | Automation constructor, mass marketing, helpdesk, CRM billing clone |

### 9.4. User stories (v3.0)

| ID | Как | Хочу | Критерии |
|----|-----|------|----------|
| C-10 | Sales agent | Создать лид с UI | Form on `/leads`; `partyKind` + contact fields persisted |
| C-11 | Agent | Указать юрлицо по VÖEN | Lookup fills `companyName`; saved on lead |
| C-12 | Agent | Вести физлицо | `partyKind=INDIVIDUAL`, phone required; optional FIN → MDM |
| C-13 | Owner | Пометить партнёра | `prospectType=PARTNER`; filter on pipeline |
| C-14 | Agent | Не перевести в QUALIFIED без VÖEN | API 400 for `LEGAL_ENTITY` without `taxId` |
| C-15 | Owner | Импортировать CSV | Upload enriched file; dedup by VÖEN/phone; import report |
| C-16 | Owner | Видеть сферу деятельности | `activitySector` from `donor_sectors` on card and list |
| C-17 | Agent | Конвертировать без ручного CP | WON → Finance counterparty exists; invoice if amount set |
| C-18 | Finance user | Видеть тот же VÖEN | CP `taxId` matches lead after convert |

### 9.5. Import — supported files

Primary template aligned with [data/legal-entities/README.md](../data/legal-entities/README.md):

| File | Use |
|------|-----|
| `azerbaijan-legal-entities.csv` | Main enriched registry |
| `azerbaijan-donors-no-tax-match.csv` | Import with `needsVoenReview` flag |
| Custom CSV/XLSX | Column mapper UI **DEFERRED** — fixed template v3.0 |

Minimum import columns: `voen` or `donor_phones`, name column, optional `donor_sectors`, `donor_emails`, `tax_legal_address`.

### 9.6. Release phases (v3.0)

| Phase | Scope |
|-------|--------|
| **C5** | Schema + API validation (`partyKind`, stage gates) |
| **C6** | Create lead UI + lead detail page |
| **C7** | Event + Finance auto-create counterparty |
| **C8** | CSV/XLSX import + SatAdmin UI + UAT |

### 9.7. Out of scope v3.0

- Bitrix-grade automation designer (unchanged from §1.4).
- Mass WA marketing.
- Automatic nightly sync from repo `data/` folder (manual upload only).
