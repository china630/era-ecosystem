# Azerbaijan companies master (e-taxes)

Canonical local DB of Azerbaijan legal entities enriched from DVX e-taxes and donor lists.

## Product files (outside git — back up)

| File | Description |
|------|-------------|
| `azerbaijan-companies-with-voen.csv` | **Master** — one row per VÖEN |
| `azerbaijan-companies-without-voen.csv` | Donors still without a matched VÖEN |
| `.companies-master-stats.json` | Last build stats |
| `.cache/etaxes-search/` | DVX API cache (gitignored; rebuild is slow) |

**Backup (mandatory before stash/clean):**

```bash
npm run backup:legal-entities
```

Mirror: `D:\ERA-BACKUP\legal-entities\latest\` (+ timestamped `snapshots\`). Rule: `.cursor/rules/era-legal-entities-backup.mdc`.

Do **not** drop a git stash that still holds master recovery blobs until backup is verified.

## Build / enrich

```bash
# Merge cache into existing master (safe if cache empty — keeps base)
npm run build:companies-master

# Token-seed wave (hotel, travel, turizm, cargo, …)
npm run enrich:etaxes-token-seeds
npm run enrich:etaxes-token-seeds:test   # first 5 seeds

# Donor sector wave (top taxpayers, green corridor, plaza tenants)
npm run enrich:etaxes:wave

# Trigram sweep (large coverage)
npm run enrich:etaxes-trigrams
```

Requires `playwright` (root `devDependency`). Env: `ETAXES_DELAY_MS` / `ETAXES_MAX_DELAY_MS`.

## Obsolete (removed)

These intermediate CSVs are **no longer used** — master replaces them:

- `azerbaijan-legal-entities.csv`
- `azerbaijan-tax-registry-expanded.csv`
- `azerbaijan-donors-no-tax-match.csv`

CRM import samples should use a **slice** of `azerbaijan-companies-with-voen.csv` (UI max ~5000 rows).

## Search notes

- Queries go through `toEtaxesSearchQuery` (az-AZ uppercasing).
- API hard-caps ~50 taxpayers per name query (`[CAP50]` in logs).
- Resume: responses cached under `.cache/etaxes-search/`.
