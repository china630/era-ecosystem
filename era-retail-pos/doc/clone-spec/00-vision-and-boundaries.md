# Vision & boundaries — ERA Retail POS

## In scope

- Point of sale: shift, register, checkout, receipt, returns (phased)
- Four vertical **presets** on one codebase: `grocery` | `apparel` | `electronics` | `pharmacy`
- Outbound typed events to orchestrator (`@era/contracts`)
- Local operational data: outlets, registers, shifts, receipts (satellite DB `era_retail_pos`)

## Out of scope

- General ledger, tax filing, invoice PDF to customer via WhatsApp
- Master product catalog, purchase orders, stock valuation
- Separate pharmacy repository (pharmacy is a preset only)

## Architecture position

```text
era-retail-pos  →  era-365-orchestrator  →  era-finance-core
   (ops)              (ingress)              (GL + AR + stock)
```

See [PRD §1–§2](../../PRD.md) for benchmarks and [01-finance-boundary](./01-finance-boundary.md).
