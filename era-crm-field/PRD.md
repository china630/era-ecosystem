# ERA CRM Field — Product Requirements Document (PRD)

> Полевой CRM и pre-sale воронка (лиды, визиты, WhatsApp/Instagram). **Не** заменяет CRM контрагентов и отправку инвойсов в Finance.  
> TZ: [TZ.md](./TZ.md) · DELIVERY: [doc/DELIVERY-CRM.md](./doc/DELIVERY-CRM.md)

| Параметр | Значение |
|----------|----------|
| **Продукт** | ERA CRM Field (`era-crm-field`) |
| **Entitlement** | `industry_crm_whatsapp` |
| **Host** | `crm.era.az` (3303) |
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
| M0 | Shell, SSO, health | — | **MVP** | — |
| M1 | Lead pipeline | Kommo pipeline | **PLANNED** | — |
| M2 | Lead card & activities | Bitrix timeline | **PLANNED** | — |
| M3 | Channel inbox (WA/IG stub) | Respond.io | **MVP** | — |
| M4 | Visit log & geo stub | — | **MVP** | — |
| M5 | Convert lead | Kommo «won» | **PLANNED** | `SATELLITE_CRM_LEAD_CONVERTED` |
| M6 | Finance handoff UI | — | **PLANNED** | Link to Finance counterparty |
| M7 | WA Business API live | Respond.io | **DEFERRED** | Finance sends invoice |

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
