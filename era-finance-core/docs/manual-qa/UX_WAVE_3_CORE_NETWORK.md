# Ручное QA — 3_core (intercompany network)

Предусловия: две организации с одинаковым `taxIdBlindIndex` (один VÖEN), у получателя `settings.networkDocuments.acceptInbound = true`, контрагент на стороне продавца с тем же VÖEN.

## Emit

1. Org A: контрагент = VÖEN org B, включить inbound у B (`/finance/network-inbox` → «Qəbulu aktiv et»).
2. Org A: счёт → SENT (начисление выручки).
3. Org B: `/finance/network-inbox` — строка PENDING, сумма = gross счёта.

## Accept / reject

1. **Qəbul et** → роль дебета, ƏDV, дата → статус POSTED, проводка Dr роль + 241 / Cr 531.
2. **Rədd et** → статус REJECTED, без проводки.

## Opt-in

1. У B `acceptInbound: false` → после SENT у A документ не создаётся.

## ERA netting (опционально)

1. На стороне A контрагент с VÖEN B, оба opt-in.
2. `POST /api/network/netting` с `partnerOrganizationId` — взаимозачёт NETTING (как обычный netting по контрагенту).
