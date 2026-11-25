# Clinic clinical notes (EMR-lite)

**Status:** Accepted (MED-P0-02 scaffold)  
**Scope:** `era-clinic` outpatient visit protocols and future inpatient reuse.

## Decision

- **SoT:** `ClinicalNoteTemplate` (org-scoped sections JSON) and `ClinicalNote` (draft → signed → amend chain).
- **HTTP:** Nest native controllers under `era-clinic/nest/native/controllers/` registered in `ClinicNativeModule`. No `app/api` routes.
- **Payload:** `ClinicalNotePayloadV1` — field snapshot with labels (same archival idea as `CpoePayloadV1`).
- **Sign gate:** Required template fields must be non-empty; API returns **409** `NOTE_REQUIRED_FIELDS`.
- **Immutability:** `SIGNED` notes are not PATCHed; corrections use `POST /api/notes/:id/amend` → new `DRAFT` with `amendsNoteId`.
- **Author sign:** Only the linked `authorPractitionerId` may call sign.
- **Audit:** `SatelliteAuditLog` via `recordClinicAudit` on create, update, sign, amend.
- **Coexistence:** Legacy `CpoeEntry` / diagnostic visit templates remain for imaging-style exam blanks; clinical notes are the structured outpatient protocol product surface.

## API (v1)

| Route | Role |
|-------|------|
| `GET/POST /api/visits/:id/notes` | List / create visit note |
| `PATCH /api/notes/:id` | Update `DRAFT` |
| `POST /api/notes/:id/sign` | Sign draft |
| `POST /api/notes/:id/amend` | Amendment draft from signed |
| `GET /api/clinical-note-templates` | Active templates for ops |
| `GET/POST /api/admin/note-templates` | SatAdmin list/create |
| `PATCH /api/admin/note-templates/:id` | Bump version on section edit |

## UI

- Visit page: `VisitClinicalNotesPanel` (template pick, fields, draft, sign).
- SatAdmin: `/admin/note-templates` (section JSON editor).

## Seed

`prisma/seed-data/base/note-templates.json` — base specialty templates loaded by `seedClinicalNoteTemplates` in `seed-vnext.ts`.

## Follow-ups (not in this wave)

- Print route for signed clinical notes (AZ/RU/EN).
- Patient card timeline feed.
- Inpatient kinds (`DAILY_DIARY`, `DISCHARGE_SUMMARY`) wired to ADT P0-05.