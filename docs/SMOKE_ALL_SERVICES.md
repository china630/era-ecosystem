# Smoke test — all ERA ecosystem services

Run from umbrella root after `cp .env.example .env`.

## Hosts file

```
127.0.0.1 app.era.az api.era.az hotel.era.az pos.era.az retail.era.az logistics.era.az construction.era.az crm.era.az auto.era.az wholesale.era.az clinic.era.az
```

## Docker full stack

```bash
docker compose build
docker compose up -d
docker compose ps
```

## HTTP health (public satellites)

| URL | Expected |
|-----|----------|
| http://hotel.era.az/api/health or /login | 200 |
| http://pos.era.az/api/health or / | 200 |
| http://retail.era.az/api/health | 200 JSON ok |
| http://logistics.era.az/api/health | 200 |
| http://construction.era.az/api/health | 200 |
| http://crm.era.az/api/health | 200 |
| http://auto.era.az/api/health | 200 |
| http://wholesale.era.az/api/health | 200 |
| http://clinic.era.az/api/health | 200 |
| http://api.era.az/auth/login | 405/400 (route alive) |

## Internal (not on Traefik)

- Finance API: `curl http://localhost:4000/api/health` if port published for dev
- Docker network: `http://finance-core:4000/api/health`

## Local build (without Docker)

Per satellite:

```bash
cd era-retail-pos && npm install && npx prisma generate && npm run build
```

Repeat for each new app under `era-*`.

## Orchestrator event path

With stack up and `SATELLITE_EVENT_SERVICE_TOKEN` set:

```bash
curl -X POST http://retail.era.az/api/events/dispatch \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"SATELLITE_RETAIL_SALE_COMPLETED\",\"payload\":{\"outletId\":\"o1\",\"registerId\":\"r1\",\"shiftId\":\"s1\",\"receiptId\":\"rc1\",\"preset\":\"grocery\",\"amountNet\":10,\"currency\":\"AZN\",\"paymentMethod\":\"CASH\",\"lineCount\":1}}"
```

Check orchestrator and finance-core logs for enqueue/worker log line.
