# Finance boundary — Construction

Canon: [construction-domain-boundaries.md](../../../docs/adr/construction-domain-boundaries.md)

| Satellite (ops) | Finance |
|-----------------|---------|
| BOQ / cost codes (site WBS), progress act header + lines | Procurement PO, PSA, commercial `Contract` (`CONSTRUCTION`), WIP/revenue journals |
| Subcontractor **claim** pack, party display name / VÖEN preview | Counterparty MDM; payables / settle |
| Approve act → `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` | Idempotent journal (AR ↔ WIP); optional draft invoice later |
| Material requisition on site | Stock / PO / pay |

Do **not** store accounting committed/actual/forecast as ledger truth in the satellite. Header `amountNet` (and optional line sum) is the ops billing pack; Finance posts money.
