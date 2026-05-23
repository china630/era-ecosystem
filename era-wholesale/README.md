# ERA Wholesale

B2B orders, credit limits, picking

- Host: `wholesale.era.az` (port 3305)
- Entitlement: `industry_wholesale`
- Docs: [PRD](./PRD.md) · [DELIVERY](./doc/DELIVERY-WHOLESALE.md)

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```
