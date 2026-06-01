# ERA CRM Field

Leads, visits, WhatsApp pre-sale (not Finance counterparty MDM)

- Host: `crm.era-365.online` (port 3303)
- Entitlement: `industry_crm`
- Docs: [PRD](./PRD.md) · [DELIVERY](./doc/DELIVERY-CRM.md)

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```
