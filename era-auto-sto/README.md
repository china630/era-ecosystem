# ERA Auto STO

Work orders, labor, parts

- Host: `auto.era.az` (port 3304)
- Entitlement: `industry_auto_sto`
- Docs: [PRD](./PRD.md) · [DELIVERY](./doc/DELIVERY-AUTO.md)

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```
