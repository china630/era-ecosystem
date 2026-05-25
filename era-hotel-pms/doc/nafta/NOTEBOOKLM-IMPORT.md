# NotebookLM import notes

## What was imported (2026-05-25)

NotebookLM returned **summary stats for 1243 screens** plus batched JSON exports. All deliverables are in `doc/nafta/`:

- `screens-manifest-v2-core.json` — Wave 3/4 anchor screens (14)
- `screens-manifest-v2-wave3-must.json` — Wave 3 must (10)
- `screens-manifest-v2-wave4.json` — Wave 4 must/should (9; TR + BQ)
- `screens-manifest-v2-wave5-must.json` — Wave 5 must (5)
- `screens-manifest-v2-merged.json` — deduped union (**27** unique `screen_id`)
- `modules-priority-matrix.json`
- `process-catalog.md`
- `user-stories-index.json`
- `open-questions-nafta.md`
- `summary-stats.json`

## Completing full manifest (optional)

**Option A — NotebookLM follow-up prompts**

Ask in separate messages:

1. «Export screens-manifest batch 1: all `priority=must` and `wave=3`, JSON array only»
2. «Export batch 2: all `wave=4` must/should»
3. «Export batch 3: wave=5 must»
4. Merge JSON arrays locally → `screens-manifest-v2.json`

**Option B — CSV merge**

If NotebookLM exported `elektraweb-screens-manifest.csv`, place in this folder and run (future script):

```bash
node scripts/merge-nafta-manifest.mjs
```

**Option C — Keep v1 + v2-core**

For implementation, v1 CSV (292) + v2-core (14) + process-catalog (40) is sufficient until Wave 5.

## Child plans unlocked

- [satellite_hotel_transfers.plan.md](../../.cursor/plans/satellite_hotel_transfers.plan.md) — TR-01…04
- [satellite_banquet.plan.md](../../.cursor/plans/satellite_banquet.plan.md) — BQ-01…03

Do **not** re-run vision on JPG in Cursor.
