# ERA Clinic

Appointments, visits, services

- Host: `clinic.era.az` (port 3306)
- Entitlement: `industry_clinic`
- Docs: [PRD](./PRD.md) · [DELIVERY](./doc/DELIVERY-CLINIC.md)

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```
