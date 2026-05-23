# ERA CRM Field

Leads, visits, WhatsApp pre-sale (not Finance counterparty MDM)

- Host: `crm.era.az` (port 3303)
- Entitlement: `industry_crm_whatsapp`
- Docs: [PRD](./PRD.md) · [DELIVERY](./doc/DELIVERY-CRM.md)

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```
