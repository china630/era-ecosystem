# Manual QA — 4_orchestrator (FIN MDM, e-Qaimə, network transport)

## Prerequisites

- `era-orchestrator` API on `:4000` with `MDM_DATABASE_URL`, `PII_*` keys
- `era-finance-core` API on `:4100`
- Env: `ORCHESTRATOR_SERVICE_TOKEN`, `ORCHESTRATOR_INTERNAL_SERVICE_TOKEN`, optional `FINANCE_INTERNAL_SERVICE_TOKEN`

## A — FIN lookup (CIT-001)

1. Seed MDM person: `POST /internal/v1/mdm/persons` with FIN + fullName (orchestrator).
2. Finance UI: CRM → new counterparty → legal form **Fiziki şəxs** → enter FIN → **Yoxla FIN**.
3. Expect name prefilled when person exists.
4. API: `POST /api/counterparties/lookup-fin` with `{ "fin": "XXXXXXX" }` returns `{ found: true, fullName }`.
5. Invalid FIN → 400 from orchestrator; missing token → 401.

## B — e-Qaimə prefill (NET-005)

1. Create network inbox doc (revenue-recognized invoice to ERA counterparty).
2. Open **Şəbəkə sənədləri** → **e-Qaimə-yə göndər** → clipboard JSON prefill.
3. `GET /api/network/documents/inbox/:id/eqaime-prefill` matches invoice extension-prefill shape.
4. **e-Qaimə ID** modal → save external id → badge shows linked ref.

## C — Cross-deploy transport

1. Default `NETWORK_DOCUMENT_TRANSPORT=in_process` — emit stays in same DB.
2. Set `NETWORK_DOCUMENT_TRANSPORT=orchestrator` on finance + orchestrator deliver endpoint → receive creates PENDING_REVIEW doc (idempotent `correlationId`).

## curl smoke

```bash
curl -X POST http://127.0.0.1:4000/internal/v1/mdm/persons/lookup-by-fin \
  -H "Authorization: Bearer $ORCHESTRATOR_INTERNAL_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fin":"ABC1234","requesterOrgId":"<org-uuid>","purpose":"test"}'
```
