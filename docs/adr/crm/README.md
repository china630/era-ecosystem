# ERA CRM — ADR index

**Home for CRM-domain ADRs.** Platform / cross-satellite ADRs stay flat in [`docs/adr/`](../).

**Living implementation tracker:** [`.cursor/plans/crm-integrations-full.plan.md`](../../../.cursor/plans/crm-integrations-full.plan.md)  
**Acceptance:** [`Crm-Acceptance-System.md`](../../acceptance/Crm-Acceptance-System.md) · Implementation / Product-Readiness / Sprint-Index under `docs/acceptance/Crm-*`.

## Reading order

| File | Role | Status |
|------|------|--------|
| [00-positioning-vs-amocrm.md](./00-positioning-vs-amocrm.md) | Gap vs amoCRM; product P0/P1/P2 | Canon (analysis) |
| [01-integrations-architecture.md](./01-integrations-architecture.md) | Integration layer ADR (kit, models, webhooks, crypto, UI/API) | **Accepted** |
| [02-catalog-messengers.md](./02-catalog-messengers.md) | 38 messenger/channel connectors | Catalog |
| [03-catalog-telephony.md](./03-catalog-telephony.md) | 46 PBX providers · 8 families | Catalog |
| [04-catalog-other.md](./04-catalog-other.md) | Calendars, ads, AI, public API keys | Catalog |
| [05-implementation-plan.md](./05-implementation-plan.md) | T-I01…T-I29 + DoD + vendor blockers | Plan mirror |
| [crm-lead-party-model-and-prospect-import.md](./crm-lead-party-model-and-prospect-import.md) | Party / import (v3.0) | Accepted |
| [crm-domain-permissions-and-rbac.md](./crm-domain-permissions-and-rbac.md) | Variant A RBAC | Accepted |

## Canon TZ

Split files `00`–`05` in this folder are the navigable canon.  
Root stub (old links): [`../CRM-INTEGRATIONS-AND-GAP-ANALYSIS.md`](../CRM-INTEGRATIONS-AND-GAP-ANALYSIS.md).

Party / RBAC ADRs live in this folder; old flat paths under `docs/adr/` are stubs pointing here.

## Locked architecture decisions (summary)

- Package `packages/integrations-kit` — shared adapters/manifests/crypto.
- Tenant credentials in CRM `IntegrationConnection` (`CRM_INTEGRATIONS_KEK`, no JWT fallback).
- Inbound webhooks: `POST /api/integrations/hooks/:providerKey/:publicId` on CRM (not orch notifications webhook).
- Orch notifications remain platform-level; tenant WABA preferred when connected.
- Payments stay in orchestrator/Finance; CRM shows status only.
- `/admin/links` ≠ `/admin/integrations`.
