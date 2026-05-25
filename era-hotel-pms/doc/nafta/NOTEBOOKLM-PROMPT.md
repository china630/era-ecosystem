# NotebookLM prompt — Elektraweb full manifest (~1500 screens)

Скопируйте блок **PROMPT** целиком в NotebookLM после загрузки источников.

## Источники для загрузки в NotebookLM

1. Все JPG скрины Elektraweb (WA0056… и далее, ~1500 файлов) — одним или несколькими notebook source batches.
2. Текстовые файлы из репозитория (если доступны как upload):
   - `era-hotel-pms/doc/reference/elektraweb-modules-catalog.md`
   - `era-hotel-pms/doc/nafta/screens-manifest.csv` (эталон ~292 строк)
   - `era-hotel-pms/doc/clone-spec/04-pms-core.md`
   - `era-hotel-pms/doc/clone-spec/05-folio-and-cash.md`
   - `era-hotel-pms/doc/clone-spec/06-channel-crm-med.md`
   - `era-hotel-pms/doc/clone-spec/15-pos-fb-spa.md`
   - `era-hotel-pms/doc/clone-spec/13-nafta-validation-checklist.md`
3. (Опционально) Excel/pricing Elektraweb, если есть в notebook.

---

## PROMPT (copy from here)

```
You are a principal hotel-systems analyst. You have access to ~1500 Elektraweb (ElektraWeb / Eptera) UI screenshots and module documentation for Nafta Sanatorium (78 rooms, Azerbaijan, sanatorium + restaurant outlets Naftani/Disco/Xudmani).

Our target product split (do NOT suggest duplicating Turkish compliance):
- era-hotel-pms: reservations, folio, night audit, packages, procedure SCHEDULE (not SPA cash), transfers, banquet BEO
- era-clinic: clinical episode, diagnoses, lab (not full EMR)
- era-fb-pos: restaurant floor, KDS, room charge, banquet SERVICE DAY execution
- era-finance-core + era-365-orchestrator: GL, e-qaimə AZ, MDM — NOT in PMS

Already implemented or in Wave 3 (mark as wave=3, do not re-specify in detail):
- Medical package SAN-PKG + EOD folio posting
- Procedure schedule PROC-SCHED
- Clinic sanatorium bridge ClinicalEpisode
- fb-pos Stage 17 room charge bridge

Wave 4 priorities we explicitly need from Elektraweb:
- Airport/hotel TRANSFERS (screens like WA0143 airport guest list, WA0227 vehicle fleet, WA0085 transfer settings) → era-hotel-pms
- BANQUETS / SalesMarketing (WA0231 banquet agreements, event BEO, hall blocking) → era-hotel-pms BEO + era-fb-pos service outlet

TASK: Produce structured deliverables for import into our git repo. Be exhaustive on MODULES and PROCESSES; be compact per screen (one row per screen, not prose per screen).

OUTPUT 1 — screens-manifest-v2.json
Array of objects. Every distinct screen you can identify from sources. Minimum fields:
{
  "screen_id": "WA0143",
  "file_ref": "IMG-20260522-WA0143.jpg",
  "elektraweb_module_code": "PMS",
  "menu_path_ru": "Фронт-офис → Трансфер отеля",
  "screen_name": "Список имен для трансфера из аэропорта",
  "screen_type": "list|form|report|settings|dashboard|other",
  "key_fields_actions": ["flight", "pickup time", "vehicle", "guest", "post to folio"],
  "links_to": { "reservation": true, "folio": true, "stay": true },
  "priority": "must|should|skip",
  "era_owner": "hotel-pms|clinic|fb-pos|finance|orchestrator|defer",
  "wave": "3|4|5|defer",
  "clone_spec_ref": "04-pms-core#4.9",
  "user_story_id": "TR-01",
  "notes": "short"
}
Rules:
- priority=skip for TR-only compliance, deep stock/PO, fixed assets, WhatsApp CRM bulk, BigQuery
- Must include ALL transfer and banquet related screens with priority must or should
- Deduplicate by screen_id; if unsure, note in notes
- Target ≥1200 unique screen_id entries OR explain gap in a summary field

OUTPUT 2 — modules-priority-matrix.json
For each Elektraweb module CODE (PMS, SalesMarketing, POS, SPA, STOCK, ChannelManager, etc.):
{
  "module_code": "SalesMarketing",
  "module_name": "...",
  "eur_license_hint": number or null,
  "nafta_usage": "heavy|light|none|unknown",
  "era_owner": "...",
  "priority": "P0|P1|P2|defer",
  "wave": "3|4|5|defer",
  "rationale": "1-2 sentences",
  "key_screens": ["WA0231", "..."]
}

OUTPUT 3 — process-catalog.md
Markdown table of 40-60 END-TO-END business processes (not individual screens):
| process_id | name | trigger | actors | main_screens | era_apps | priority | wave |
Include at minimum: check-in/out, night audit, medical package EOD, procedure schedule, transfer IN/OUT, banquet BEO to service day, fb room charge, lab order lifecycle, channel stop-sell, agency ledger.

OUTPUT 4 — user-stories-index.json
Array: { "id": "US-01", "role": "...", "story": "...", "elektraweb_refs": ["WA..."], "era_owner": "...", "wave": "..." }
Reuse IDs US-01… from sanatorium analysis where possible; add TR-xx transfers, BQ-xx banquets.

OUTPUT 5 — open-questions-nafta.md
Numbered questions for on-site validation with Nafta (transfers pricing, banquet frequency, included vs extra, hall names, etc.)

OUTPUT 6 — summary-stats.json
{ "total_screens_indexed": N, "by_priority": {...}, "by_era_owner": {...}, "by_wave": {...}, "gaps": ["..."] }

FORMAT RULES:
- Valid JSON for outputs 1,2,4,6 (no trailing commas, no comments inside JSON)
- Markdown only for outputs 3 and 5
- Language: Russian for labels/names where visible on screenshots; English for enum values (priority, era_owner, wave)
- Do NOT output base64 images or long OCR dumps
- At the end, print a single fenced code block for EACH deliverable separately so we can copy-paste into files

Cross-check against existing partial manifest (screens-manifest.csv): extend, do not replace blindly; flag conflicts.
```

---

## После ответа NotebookLM

1. Сохраните JSON/Markdown в `era-hotel-pms/doc/nafta/` (имена как в OUTPUT).
2. В Cursor: «импортируй screens-manifest-v2.json, обнови README и child plans HN-7/HN-8» — **без** повторного vision по JPG.
3. Валидация: `screen_id` unique count, transfers/banquets present, JSON parse OK.
