# Nafta package — e2e mix 289 + share smoke

**Status:** Lab / FO script (pilot polish P1.4). Not a green CI gate.

## Mix card → folio 289

1. Create FO reservation, 2 adults, agency medical (or Extra `ERA-PKG`).
2. Guests tab: pax1 `PKG-PREMIUM`, pax2 `PKG-STANDART` → Save.
3. Expect `dailyRates` / folio `packageCompose` nightly sell **289** (193+96).
4. Check-in → **two** guest-lifecycle events (`paxKey` + per-pax `programCode`).
5. Clinic `/sanatorium`: **two** rows same room; quotas isolated per episode.
6. Night audit: package charges scale to **289**; line split prefers main (Premium) rate-plan package lines when present.

## Share 707 / 707S regression

1. Two share-eligible singles on same door (707 + 707S pattern).
2. Each reservation keeps own medical SKU / episode — **no merge**.
3. Compose is per reservation folio (not combined 289 across share neighbors unless same card).

## Curl sketch (lab)

```bash
# After FO save — preview compose (auth cookie required)
curl -sS "$HOTEL/api/reservations/$ID/full" | jq '.dailyRates,.packageCompose'
```

Record results in `reports/nafta-pkg-pilot-punch.md` §40–41.
