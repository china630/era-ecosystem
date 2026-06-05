# 4_orchestrator — БД граждан, e-Qaimə, кросс-деплой NetworkDocument

**Волна:** `orchestrator-integration-wave-1`  
**Документы:** PRD §4.18 (`FEAT-FC-CIT-001`), §4.19 (`FEAT-FC-NET-005/006`, §29.6–29.8)  
**Зависимости:** запускать **после** `1_core.md`, `2_core.md` (FIN UI), `3_core.md` (модель `NetworkDocument` + transport interface).  
**Репозитории:** `era-orchestrator` + доработки в `era-finance-core`.  
**Статус:** ✅ выполнено — чек-лист приёмки отмечен 2026-06-05; **отложено:** E2E `multi-finance` (§C.6).

---

## 0. Definition of Done

1. Оркестратор отдаёт **lookup гражданина по FIN** (service-token, PII masking) из MDM БД `global_natural_persons`.
2. Финядро имеет `OrchestratorMdmClient` и использует его в контрагентах (UX-007) и HR (future).
3. `NetworkDocument` маппится в DTO **e-Qaimə prefill** (существующий `InvoicePrefillSchema` / extension flow).
4. Заготовлен **кросс-деплой transport** для доставки network docs через CP (реализация HTTP fan-out).

---

## Часть A — FEAT-FC-CIT-001: БД граждан (MDM)

### A.1. Текущее состояние

| Компонент | Путь |
|-----------|------|
| MDM schema | `era-orchestrator/packages/mdm-database/prisma/schema.prisma` |
| Model | `GlobalNaturalPerson` (`finBlindIndex`, `finCipher`, `fullNameCipher`, `phoneCipher`) |
| Service | `era-orchestrator/apps/api/src/mdm/mdm.service.ts` — `upsertNaturalPerson`, **нет read-by-FIN для finance** |
| Controller | `era-orchestrator/apps/api/src/internal/v1/mdm` → `MdmController` |
| DB URL | `MDM_DATABASE_URL` (отдельная БД, option B) |
| Crypto | `blindIndexFin`, `encryptText` / `decryptText` |

**Существующие internal endpoints:**

- `POST /internal/v1/mdm/persons` — upsert
- `POST /internal/v1/mdm/organizations/lookup-by-voen`

### A.2. Новый endpoint (orchestrator)

**Добавить в** `mdm.controller.ts`:

```typescript
@Post("persons/lookup-by-fin")
lookupByFin(
  @Body() body: { fin: string; requesterOrgId?: string; purpose?: string },
  @Headers("authorization") auth?: string,
) {
  this.assertServiceToken(auth);
  return this.mdm.lookupNaturalPersonByFin(body);
}
```

**Добавить в** `mdm.service.ts`:

```typescript
async lookupNaturalPersonByFin(input: {
  fin: string;
  requesterOrgId?: string;
  purpose?: string;
}) {
  const fin = input.fin.trim().toUpperCase();
  if (!/^[A-Z0-9]{7}$/.test(fin)) {
    throw new BadRequestException("Invalid FIN format");
  }
  const finBlindIndex = blindIndexFin(fin);
  const person = await this.mdm.globalNaturalPerson.findUnique({
    where: { finBlindIndex },
  });
  if (!person) {
    return { found: false };
  }
  // Audit log (PersonAccessLog) — purpose + requesterOrgId
  await this.logPersonAccess(person.id, input);
  return {
    found: true,
    globalPersonId: person.id,
    fullName: decryptText(person.fullNameCipher),
    // mask: only return fullName if grant exists; MVP: return name for service callers
    phone: person.phoneCipher ? maskPhone(decryptText(person.phoneCipher)) : null,
  };
}
```

**PII policy (MVP):**

- Вызов только с **service token** (finance-core, satellites).
- Логировать каждый lookup в `PersonAccessLog`.
- Опционально: проверка `PersonAccessGrant` перед полным раскрытием — если нет grant, вернуть только `found: true` + `globalPersonId`.

### A.3. Service token guard

**Создать/использовать** guard как у других internal routes:

```typescript
// env: ORCHESTRATOR_INTERNAL_SERVICE_TOKEN
// Header: Authorization: Bearer <token>
```

Сверить с `CONTROL_PLANE_SERVICE_TOKEN` / finance `ORCHESTRATOR_SERVICE_TOKEN` naming в `.env.example` монорепо.

### A.4. Finance-core client

**Создать:** `era-finance-core/apps/api/src/orchestrator/orchestrator-mdm-client.service.ts`

```typescript
@Injectable()
export class OrchestratorMdmClientService {
  private baseUrl(): string {
    return process.env.ORCHESTRATOR_INTERNAL_URL ?? "http://orchestrator:3001";
  }
  private token(): string {
    return process.env.ORCHESTRATOR_SERVICE_TOKEN ?? "";
  }

  async lookupPersonByFin(fin: string, requesterOrgId: string): Promise<LookupResult | null> {
    const res = await fetch(`${this.baseUrl()}/internal/v1/mdm/persons/lookup-by-fin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fin, requesterOrgId, purpose: "counterparty_verify" }),
    });
    if (!res.ok) return null;
    return (await res.json()) as LookupResult;
  }
}
```

**Module:** `orchestrator.module.ts` — `@Global()` optional.

### A.5. Wire в finance-core

**`counterparties.service.ts` — create/update:**

При `kind === INDIVIDUAL` и `dto.finCode`:

```typescript
const remote = await this.orchestratorMdm.lookupPersonByFin(dto.finCode, organizationId);
if (remote?.found && remote.fullName) {
  // prefill nameCipher path
}
```

**`CreateCounterpartyModal.tsx` (2_core):** кнопка «Yoxla FIN» → `POST /api/counterparties/lookup-fin` → finance proxy to orchestrator.

**Новый endpoint finance:**

```
POST /api/counterparties/lookup-fin
Body: { fin: string }
```

### A.6. Env (монорепо)

**`.env.example` (root):**

```env
ORCHESTRATOR_INTERNAL_URL=http://orchestrator:3001
ORCHESTRATOR_SERVICE_TOKEN=change-me-internal
MDM_DATABASE_URL=postgresql://mdm:mdm@postgres:5432/era_mdm
```

**Docker compose:** finance container must reach `orchestrator` on `era-network`.

### A.7. Тесты

**Orchestrator:** `era-orchestrator/apps/api/test/mdm-lookup-fin.spec.ts`

**Finance:** mock `OrchestratorMdmClientService` in counterparty create test.

### A.8. Приёмка CIT-001

- [x] `POST persons/lookup-by-fin` с валидным FIN возвращает person
- [x] Невалидный FIN → 400
- [x] Без token → 401
- [x] Finance proxy endpoint работает
- [x] UI FIN check заполняет имя (после 2_core)

---

## Часть B — FEAT-FC-NET-005: e-Qaimə prefill из NetworkDocument

### B.1. Контекст (уже в finance-core)

| Артефакт | Путь |
|----------|------|
| Prefill builder | `invoices.service.ts` → `getExtensionPrefill` (~170–260) |
| Schema | `@era/contracts` `InvoicePrefillSchema` |
| Controller | `invoices.controller.ts` — `GET .../extension-prefill` |
| Extension | `era-finance-core/apps/extension` — RPA widget DVX/eqaime |
| Sync runs | `integration-sync-run.service` — `flow: "eqaime"` |

**D-NET-2:** e-Qaimə — **легальный** источник; ERA network doc **предзаполняет** тот же DTO.

### B.2. Новый сервис

**Создать:** `apps/api/src/network/network-eqaime-prefill.service.ts`

```typescript
async buildPrefillFromNetworkDocument(
  recipientOrgId: string,
  networkDocId: string,
): Promise<InvoicePrefill> {
  const doc = await this.loadDocForRecipient(recipientOrgId, networkDocId);
  // Map doc.lines JSON → InvoicePrefill.items (same shape as getExtensionPrefill)
  // counterparty = issuer org decoded name + taxId from issuerTaxIdBlindIndex
  return InvoicePrefillSchema.parse({ ... });
}
```

### B.3. API

```
GET /api/network/documents/inbox/:id/eqaime-prefill
```

Returns same JSON as `GET /api/invoices/:id/extension-prefill`.

**После успешного RPA sync** (extension callback):

- Update `network_documents.eQaimeRef` = `externalId` from bulk sync result
- Optional: link to purchase invoice if B created mirror purchase doc

### B.4. UI

На странице inbox (`3_core`):

- Кнопка «e-Qaimə-yə göndər» → opens extension deep link or copies prefill payload
- Badge: `eQaimeRef` present / mismatch warning

### B.5. Reconciliation

**Создать** сравнение в `network-document.service.ts`:

```typescript
compareWithEQaime(docId): { status: 'MATCH' | 'MISMATCH' | 'MISSING', diff?: ... }
```

Показывать в inbox detail если `eQaimeRef` set.

### B.6. Приёмка e-Qaimə

- [x] Prefill endpoint для network doc
- [x] Extension может использовать тот же autofill pipeline
- [x] `eQaimeRef` сохраняется после sync
- [x] Документация: ERA network ≠ legal substitute *(PRD §4.19 D-NET-2, TZ §29 D-NET-2)*

---

## Часть C — Кросс-деплой NetworkDocument (§29.8)

### C.1. Проблема

Сейчас все org в одной БД finance → `NetworkDocument` insert in-process.

Если buyer org в **другом деплое** (другой finance instance), нужен CP-mediated delivery.

### C.2. Контракт transport (finance-core)

**Файл:** `apps/api/src/network/transport/network-document-transport.ts`

```typescript
export type NetworkDocumentPayload = {
  correlationId: string;
  issuerOrganizationId: string;
  recipientOrganizationId: string;
  sourceInvoiceId: string;
  currency: string;
  totalNet: string;
  vatAmount: string;
  totalGross: string;
  lines: unknown[];
  issuerInvoiceNumber?: string;
  issuerTaxIdBlindIndex?: string;
};

export interface NetworkDocumentTransport {
  deliver(payload: NetworkDocumentPayload): Promise<void>;
}
```

**Implementations:**

| Class | When |
|-------|------|
| `InProcessNetworkDocumentTransport` | default — `prisma.networkDocument.create` in same DB |
| `OrchestratorNetworkDocumentTransport` | `NETWORK_DOCUMENT_TRANSPORT=orchestrator` |

### C.3. Orchestrator fan-out endpoint

**Создать в** `era-orchestrator`:

```
POST /internal/v1/network-documents/deliver
Authorization: Bearer <service-token>
Body: NetworkDocumentPayload + targetFinanceBaseUrl? (optional)
```

**Service logic:**

1. Resolve `recipientOrganizationId` → deployment routing table (new CP table or `Organization.settings.deploymentKey`)
2. HTTP POST to target finance: `POST /internal/v1/network-documents/receive`
3. Idempotent on `correlationId`

**Finance receive endpoint (internal):**

```
POST /internal/v1/network-documents/receive
```

Creates `NetworkDocument` PENDING_REVIEW if not exists.

### C.4. Routing table (MVP)

**Option A — same monorepo deploy:** `InProcess` only, orchestrator route returns 501.

**Option B — CP settings:**

```prisma
// era-orchestrator control plane
model OrganizationDeployment {
  organizationId String @id
  financeApiBaseUrl String
}
```

Seed localhost URLs for dev.

### C.5. Env

```env
NETWORK_DOCUMENT_TRANSPORT=in_process   # | orchestrator
FINANCE_INTERNAL_SERVICE_TOKEN=...
```

### C.6. Приёмка cross-deploy

- [x] Interface + InProcess implementation (default)
- [x] Orchestrator deliver + finance receive stubs wired
- [x] Idempotent receive
- [ ] E2E test with two finance URLs (docker compose profile `multi-finance` — optional future)

---

## Часть D — Связь с data-hub (справочно)

VÖEN directory для network match остаётся в finance `Organization.taxIdBlindIndex` (not orchestrator MDM legal entity — both should align on same blind index algorithm).

**Verify:** `blindIndexForVoen` in orchestrator `voen-blind-index.ts` matches finance `blindIndex("voen", ...)` — add cross-package test or shared util in `@era/shared-crypto` if mismatch found.

---

## Порядок реализации внутри 4_orchestrator

1. **A** — FIN lookup (orchestrator + finance client + proxy API) — unblocks 2_core FIN button
2. **B** — e-Qaimə prefill from network doc — depends on 3_core model
3. **C** — transport interface + stubs — can ship InProcess only first, orchestrator HTTP second

---

## Команды проверки

```powershell
# Orchestrator
cd "d:\My Projects\era-ecosystem\era-orchestrator"
npm ci
npm run db:generate
npm run test:api

# Finance integration
cd "d:\My Projects\era-ecosystem\era-finance-core"
npm run build -w @erafinance/api
```

**Manual:**

```bash
curl -X POST http://localhost:3001/internal/v1/mdm/persons/lookup-by-fin \
  -H "Authorization: Bearer $ORCHESTRATOR_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fin":"ABC1234","requesterOrgId":"<uuid>","purpose":"test"}'
```

---

## Чек-лист приёмки 4_orchestrator

- [x] MDM `lookup-by-fin` + access log
- [x] Finance `OrchestratorMdmClientService` + `/api/counterparties/lookup-fin`
- [x] `GET network/documents/.../eqaime-prefill` + `eQaimeRef` update on sync
- [x] `NetworkDocumentTransport` InProcess + Orchestrator stub
- [x] Orchestrator `network-documents/deliver` + finance `receive`
- [x] VÖEN blind index alignment documented/tested
- [x] `.env.example` updated in monorepo root

---

## Файлы по репозиториям (summary)

### era-orchestrator

- `apps/api/src/mdm/mdm.controller.ts`
- `apps/api/src/mdm/mdm.service.ts`
- `apps/api/src/network/network-documents.controller.ts` (new module)
- `packages/mdm-database/prisma/schema.prisma` (only if new fields needed)

### era-finance-core

- `apps/api/src/orchestrator/orchestrator-mdm-client.service.ts`
- `apps/api/src/counterparties/counterparties.controller.ts` — lookup-fin
- `apps/api/src/network/network-eqaime-prefill.service.ts`
- `apps/api/src/network/transport/*`
- `apps/api/src/network/internal-network-documents.controller.ts`

---

## Не входит

- Полная реализация AZ citizens государственного реестра (только MDM stub/upsert + lookup)
- Замена e-Qaimə RPA widget (extension остаётся)
- Multi-region production routing (только контракт + MVP table)
