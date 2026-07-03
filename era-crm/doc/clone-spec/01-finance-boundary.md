# Finance boundary

- Catalog, GL, CRM counterparty, WhatsApp **invoice delivery** → **finance-core**
- This satellite: **leads, visits, WhatsApp pre-sale funnel** only
- Converted lead → event → Finance creates/updates counterparty + invoice (no duplicate MDM here)
- **v3.0 (planned):** lead carries `partyKind`, `taxId`, sector; Finance auto-creates CP on convert — [ADR](../../../docs/adr/crm-lead-party-model-and-prospect-import.md)
- **v3.1+ (deferred):** Bitrix parity items (inbox, timeline, merge, …) — same ADR §8; not in satellite scope until v3.0 ships
