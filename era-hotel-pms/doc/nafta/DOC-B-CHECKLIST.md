# DOC-B checklist — Hospitality Nafta (Wave 3 / 4)

> Обновлять **в том же commit**, что и код (см. orchestrator execution rule §6).  
> HN-5 — финальный audit, не единственный момент для документации.

## Umbrella (`docs/`)

| Doc | HN-0 | HN-1 | HN-2 | HN-3 | HN-P | HN-4 | HN-N | HN-7 | HN-8 | HN-5 |
|-----|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
| DEVELOPMENT_ROADMAP.md Wave 3/4 row | | x | x | x | x | | x | x | x | verify |
| SATELLITE_DOCUMENTATION.md sanatorium | | x | | x | | | x | x | x | verify |
| SMOKE_ALL_SERVICES.md curls | | x | x | x | x | x | | x | x | verify |
| SETUP_AND_RUN.md env | | | | x | x | | | x | | verify |
| INTEGRATION_SSO_EVENTS.md | | | | x | | | | | | if events |

## era-hotel-pms

| Doc | HN-1 SAN-PKG | HN-2 PROC | HN-7 TRANS | HN-8 BANQ |
|-----|:------------:|:---------:|:----------:|:---------:|
| doc/DELIVERY.md Stage 18–21 | x | x | x | x |
| doc/UAT-SMOKE.md | x | x | x | x |
| PRD.md §8 changelog | x | x | x | x |
| TZ.md / README API routes | x | x | x | x |
| doc/DOCUMENTATION-INDEX.md | x | x | x | x |
| clone-spec/06 Part C package | x | | | |
| clone-spec/04 §4.9 transfers | | | x | |
| clone-spec/14 phase2 roadmap | x | x | | x |
| clone-spec/15 banquet note | | | | x |
| doc/nafta/README.md | x | x | x | x |
| messages en/ru/az (new UI) | | x | | x |

## era-clinic

| Doc | HN-3 K5 |
|-----|:-------:|
| doc/DELIVERY-CLINIC.md K5 Sanatorium | x |
| doc/UAT-SMOKE.md (if exists) or README smoke | x |
| PRD.md §8 | x |
| TZ.md sanatorium API | x |
| doc/DOCUMENTATION-INDEX.md | x |
| doc/clone-spec/01-finance-boundary.md billing note | x |

## era-fb-pos

| Doc | HN-4 | HN-8 |
|-----|:----:|:----:|
| doc/DELIVERY-FB.md | x | x |
| doc/UAT-SMOKE.md §11 | x | |
| PRD.md §8 | if fix | x |
| doc/DOCUMENTATION-INDEX.md | if touch | x |

## era-365-orchestrator

| Doc | HN-P |
|-----|:----:|
| doc/DELIVERY-ORCHESTRATOR.md MDM section | x |
| doc/adr/era-mdm-phase1.md | x |
| .env.example MDM_DATABASE_URL | x |
| docs/SMOKE_ALL_SERVICES.md mdm curls | x |

## HN-N NotebookLM import

| Artifact | Path | Status |
|----------|------|--------|
| screens-manifest-v2-core.json | doc/nafta/ | [x] 14 core screens |
| screens-manifest-v2.json (full) | doc/nafta/ | [ ] optional merge — see NOTEBOOKLM-IMPORT.md |
| modules-priority-matrix.json | doc/nafta/ | [x] |
| process-catalog.md | doc/nafta/ | [x] |
| user-stories-index.json | doc/nafta/ | [x] |
| open-questions-nafta.md | doc/nafta/ | [x] |
| summary-stats.json | doc/nafta/ | [x] |
| NOTEBOOKLM-IMPORT.md | doc/nafta/ | [x] |
| DOCUMENTATION-INDEX nafta section | doc/DOCUMENTATION-INDEX.md | [x] |
| satellite_hotel_transfers.plan.md | .cursor/plans/ | [x] authored |
| satellite_banquet.plan.md | .cursor/plans/ | [x] authored |

## Child plans (`.cursor/plans/`)

После gate шага: YAML todos `completed` + markdown checklists `[x]` в:

- satellite_hotel_san_pkg.plan.md
- satellite_hotel_proc_sched.plan.md
- satellite_clinic_sanatorium_bridge.plan.md
- platform_mdm_phase1.plan.md
- satellite_hotel_transfers.plan.md (after HN-7)
- satellite_banquet.plan.md (after HN-8)

**Не** редактировать `hospitality_nafta_orchestrator_a0426e2f.plan.md` во время execution.
