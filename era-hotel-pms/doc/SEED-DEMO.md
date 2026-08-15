# Demo data (Front Office)

Run after migrations:

```powershell
cd era-hotel-pms
# Password: see tmp/era-local-credentials.md (often change-me-strong-password, not era_dev_password)
$env:DATABASE_URL="postgresql://era:change-me-strong-password@localhost:5432/era_hotel_pms?schema=public"
npm run db:seed
```

Docker:

```powershell
docker exec -e DATABASE_URL="postgresql://era:era_dev_password@postgres:5432/era_hotel_pms?schema=public" era-hotel-pms npx tsx prisma/seed.ts
```

## Stay time policy

All planned stays use **check-in 14:00** and **check-out 12:00** Asia/Baku (`src/lib/hotel-calendar.ts`). Seed and volume loaders must not invent UTC-midnight (04:00 Baku) timestamps.

## Contents

| Entity | Count (approx.) |
|--------|-----------------|
| Guests | 28 (AZ/RU/EU/ME + corporate) |
| Reservations | 35+ (all statuses) |
| In-house | 8 |
| With notes | 12+ |
| Group | `GRP-NAFTA-MAY26` (4 rooms) |
| Unassigned | 2 |
| Business days | yesterday CLOSED + today OPEN |
| HK | OOO 401, DIRTY 402, tasks on 104 |

Statuses: `IN_HOUSE`, `CONFIRMED`, `OPTION`, `CANCELLED`, `NO_SHOW`, `CHECKED_OUT`.

**Room plan rule:** for each room, `CONFIRMED` / `IN_HOUSE` / `OPTION` must not overlap (`seed-fo-demo` throws on conflict). Examples: **301** next booking starts at `today+8` (after in-house ends `today+7`); **204** arrival at `today+3` (after in-house ends `today+2`); **203** turnover chain starts `today+1` (in-house departure today ends before chain).

**Consecutive same-room chains** (room plan / rack turnover demos):

| Room | Pattern |
|------|---------|
| **203** | 6 bookings from tomorrow: back-to-back ×3, 1-night gap, next-day arrival, option with gap |
| **403** | 5 bookings from +7d: back-to-back ×2, next-day gap, back-to-back, 2-night gap + 3 nights |

Notes in DB: `203 chain N/6`, `403 chain N/5`.

## Volume loader (`load-nafta-transactions.cjs`)

Optional denser dataset for UAT volume (wipes guests/reservations/folios first). Uses the same 14:00/12:00 Baku policy and **skips** placements that would double-book a room.

```powershell
docker exec -e DATABASE_URL="postgresql://era:era_dev_password@postgres:5432/era_hotel_pms?schema=public" era-hotel-pms node prisma/load-nafta-transactions.cjs
```

For clean arrow/turnover demos prefer `npm run db:seed` (FO demo chains). Use the volume loader only when you need headcount, not when validating room-plan shapes.

Logins: `admin` / `admin123`, `reception` / `reception123`, `manager` / `manager123`.

## Playwright UI check

```powershell
# hotel on :3201
npm run test:e2e -- e2e/demo-data-verify.spec.ts
```
