# ERA Auto STO

Work orders, labor, parts

- Host: `auto-service.era-365.online` (port 3304)
- Entitlement: `industry_auto_service`
- Docs: [PRD](./PRD.md) · [DELIVERY](./doc/DELIVERY-AUTO.md)

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```
