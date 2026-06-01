# ERA Retail POS

POS with grocery, apparel, electronics, pharmacy presets. **PRD v1.0** — benchmarks, modules R0–R4, user stories.

- Host: `retail-pos.era-365.online` (port 3300)
- Entitlement: `industry_retail`
- Docs: [PRD](./PRD.md) · [DELIVERY](./doc/DELIVERY-RETAIL.md)

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```
