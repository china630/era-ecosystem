# ERA Hotel PMS (`era-hotel-pms`)

Standalone hospitality satellite: **Next.js + Prisma + PostgreSQL + Redis**, outbound JSON events to Nafta 1C bridge or ERA Finance gateway.

Product spec: [`doc/clone-spec/README.md`](doc/clone-spec/README.md) · Delivery: [`doc/DELIVERY.md`](doc/DELIVERY.md)  
F&B POS satellite: [`../era-fnb-pos/README.md`](../era-fnb-pos/README.md) · PMS bridge: [`doc/clone-spec/23-pos-bridge.md`](doc/clone-spec/23-pos-bridge.md) · Doc index: [`doc/DOCUMENTATION-INDEX.md`](doc/DOCUMENTATION-INDEX.md)  
**UI shell:** [`docs/UI_PLAYBOOK_SATELLITES.md`](../docs/UI_PLAYBOOK_SATELLITES.md) · `HotelOpsShell` → `EraAppRouteShell` (no auth/locale in sidebar footer).

## Quick start (Docker — recommended)

**Standalone** (this folder's `docker-compose.yml`):

```bash
copy .env.example .env.local
docker compose up -d
```

- App: [http://localhost:3000](http://localhost:3000) (standalone) · **umbrella stack: [http://localhost:3201](http://localhost:3201)**
- [Login](http://localhost:3000/login) — demo: `admin` / `admin123`, `reception` / `reception123`, `manager` / `manager123`
- **Front Office:** Chessboard `/`, [Room plan](http://localhost:3201/room-plan), [Reservations](http://localhost:3201/reports/reservations), [Group reservations](http://localhost:3201/reports/group-reservations), [FO with notes](http://localhost:3201/reports/reservations/notes), [In-house](http://localhost:3201/in-house), [Daily in-house](http://localhost:3201/reports/inhouse-daily), [EOD logs](http://localhost:3201/reports/end-of-day-logs)
- **Ops / distribution / HK:** [Operations](http://localhost:3201/operations), [Channel](http://localhost:3201/channel), [Housekeeping](http://localhost:3201/housekeeping), [Closed rooms](http://localhost:3201/housekeeping/closed-rooms), [Guests](http://localhost:3201/guests)
- ElectraWeb parity: [`doc/ELEKTRAWEB-PARITY.md`](doc/ELEKTRAWEB-PARITY.md) · [`doc/FRONT-OFFICE-ELECTRAWEB.md`](doc/FRONT-OFFICE-ELECTRAWEB.md)
- UAT checklist: [`doc/UAT-SMOKE.md`](doc/UAT-SMOKE.md)

Production profile:

```bash
docker compose --profile prod up -d --build
```

## Quick start (local)

### 1. Infrastructure

```bash
docker compose up -d postgres redis
```

### 2. Environment

```bash
copy .env.example .env.local
```

### 3. Database

Migrations include Wave B FO parity: `20260601120000_wave_b_full` (daily rates, guest identity, HK/distribution entities). Earlier: `20260522120000_phase1_full`, `20260523100000_auth_rbac`, `20260524100000_phase1_closure`.

```bash
npm install
npx prisma migrate deploy
npm run db:seed
```

If you previously used the old demo schema: `docker compose down -v`, then migrate + seed again.

### 4. Run

```bash
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Prisma generate + production build |
| `npm run start` | Production server |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:seed` | Seed master data + sample reservations |
| `docker compose up -d` | Postgres + Redis + app (dev) |

## Auth (satellite-local RBAC)

Spec: [`doc/clone-spec/21-satellite-rbac.md`](doc/clone-spec/21-satellite-rbac.md) · Seat quotas: [`doc/clone-spec/20-seat-licensing.md`](doc/clone-spec/20-seat-licensing.md)

| Path | Description |
|------|-------------|
| `POST /api/auth/login` | Staff login → JWT cookie |
| `POST /api/auth/logout` | Clear session |
| `GET /api/auth/me` | Current user + permissions |
| `POST /api/auth/sso/exchange` | ERA Core → Financial_Auditor |
| `GET/POST /api/admin/users` | User CRUD + seat check |

Set `AUTH_JWT_SECRET` (min 16 chars) in `.env.local`. Other APIs require a valid session (middleware).

## API overview

| Area | Paths |
|------|-------|
| Rooms | `GET/POST /api/rooms`, `PATCH /api/rooms/:id/status` |
| Reservations | `GET/POST /api/reservations`, `GET /api/reservations/arrivals` |
| Room plan | `GET /api/room-plan`, `PATCH /api/reservations/:id/schedule` |
| Reports | `GET /api/reports/occupancy?days=30` |
| Assign / lifecycle | `POST .../assign`, `.../check-in`, `.../check-out`, `PATCH .../cancel` |
| Folio | `GET/POST /api/folios`, `POST /api/folios/charges/:id/void` (Manager) |
| Master data | `/api/hotel/profile`, `/api/master/room-types`, `rate-plans`, `revenue-codes` |
| Housekeeping | `GET/POST /api/housekeeping/tasks` |
| Channel | `GET/POST/PATCH /api/channel/errors` |
| Medical | `GET/POST /api/medical/alerts`, `POST /api/medical/orders` |
| Night audit | `GET /api/night-audit/status`, `POST /api/night-audit/run` |
| Integration | `POST /api/integration/retry`, mock receiver, mock licensing |

Check-out closes folios, marks room `DIRTY`, dispatches `SATELLITE_HOTEL_RESERVATION_COMPLETED` from folio lines (see [`doc/clone-spec/19-satellite-bridge-event.md`](doc/clone-spec/19-satellite-bridge-event.md)).

## Integration

- Code: [`src/lib/integration/event-dispatcher.ts`](src/lib/integration/event-dispatcher.ts)
- Redis retry queue: `outbound:retry`
- Env: `EXTERNAL_INTEGRATION_URL`, `EXTERNAL_NIGHT_AUDIT_URL`, `REDIS_URL`
