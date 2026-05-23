# ERA Retail POS

POS with grocery, apparel, electronics, pharmacy presets

- Host: `retail.era.az` (port 3300)
- Entitlement: `industry_retail_ecom`
- Docs: [PRD](./PRD.md) · [DELIVERY](./doc/DELIVERY-RETAIL.md)

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```
