# ERA Data Hub — API examples (curl)

Replace `BASE` and `KEY` / `TOKEN` for your environment.

```bash
BASE=http://127.0.0.1:4200/registry/v1
KEY=dev-data-hub-key
TOKEN=dev-data-hub-service-token
```

## Auth

External:

```bash
curl -sS -H "X-Api-Key: $KEY" "$BASE/fx/rates?symbols=USD,EUR"
```

Internal service:

```bash
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/fx/rates?symbols=USD,EUR"
```

## FX

```bash
curl -sS -H "X-Api-Key: $KEY" "$BASE/fx/rates?date=2026-06-01&symbols=USD,EUR"
curl -sS -H "X-Api-Key: $KEY" "$BASE/fx/rates/range?from=2026-05-01&to=2026-05-31&symbol=USD"
curl -sS -H "X-Api-Key: $KEY" "$BASE/fx/convert?from=USD&to=EUR&amount=100&date=2026-06-01"
```

## Calendar (AZ)

```bash
curl -sS -H "X-Api-Key: $KEY" "$BASE/calendar/az/is-working-day?date=2026-06-02"
curl -sS -H "X-Api-Key: $KEY" "$BASE/calendar/az/add-business-days?date=2026-06-01&n=5"
```

## HS / tariff

```bash
curl -sS -H "X-Api-Key: $KEY" "$BASE/hs/8471300000"
curl -sS -H "X-Api-Key: $KEY" "$BASE/hs/8471300000/tariff?date=2026-06-01"
```

## Companies (VÖEN)

```bash
curl -sS -H "X-Api-Key: $KEY" "$BASE/companies/1234567890?maskPii=true"
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/companies/1234567890?maskPii=false"
```

## Banks / IBAN

```bash
curl -sS -H "X-Api-Key: $KEY" "$BASE/banks"
curl -sS -H "X-Api-Key: $KEY" "$BASE/banks/branches/505099"
curl -sS -H "X-Api-Key: $KEY" "$BASE/iban/validate?iban=AZ21NABZ01350100000000000200"
```

## Geo / UoM / tax / CoA

```bash
curl -sS -H "X-Api-Key: $KEY" "$BASE/geo/countries"
curl -sS -H "X-Api-Key: $KEY" "$BASE/geo/cities?country=AZ"
curl -sS -H "X-Api-Key: $KEY" "$BASE/uom"
curl -sS -H "X-Api-Key: $KEY" "$BASE/tax-rates?type=VAT&date=2026-06-01"
curl -sS -H "X-Api-Key: $KEY" "$BASE/chart-of-accounts?profile=commercial"
```

## Errors

JSON body: `{ "code": "HS_NOT_FOUND", "message": "..." }` with HTTP 4xx.
