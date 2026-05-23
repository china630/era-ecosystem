# ERA Logistics

Fleet, trips, POD

- Host: `logistics.era.az` (port 3301)
- Entitlement: `industry_logistics_customs`
- Docs: [PRD](./PRD.md) · [DELIVERY](./doc/DELIVERY-LOGISTICS.md)

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```
