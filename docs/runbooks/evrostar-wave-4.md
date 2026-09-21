# Evrostar Wave 4 — personnel orders + workforce audit UAT

**ADR:** [evrostar-workforce-pilot.md](../adr/evrostar-workforce-pilot.md) §3–4  
**Capability:** `CP-WF-ORD-02` (API + UI; **not SHIPPED** until three client blanks print UAT)  
**Depends on:** Waves 0–1 (employment mirror + `hr_full` for leave remaining)

## Goal

Printable hire / terminate / leave orders with org/holding HTML templates (az/ru), frozen snapshot at ISSUED (including Finance `vacationDaysBalance`), cancel DRAFT, and closed audit for import / staff-schedule submit / PDF.

## Preconditions

- Org has `platform_workforce`; Finance org has `hr_full` for leave remaining (otherwise `leave.remainingDays` = null / «—»).
- Optional: upload org HTML templates under **Templates** (else builtin blanks).

## UAT steps

1. **Hire → DRAFT** — Hire employee → personnel-orders shows DRAFT HIRE (`EQ-YYYY-#####`), not ISSUED.
2. **Issue snapshot** — Issue HIRE → PDF shows name, position, org; Finance contract salary when mirrored.
3. **Leave** — Approve VACATION absence → DRAFT `LEAVE_ANNUAL`; Issue → remaining days from Finance; second PDF does not re-fetch (uses `contextJson`).
4. **Numbering** — Create TERMINATE on org A and org B → independent sequences; HIRE vs LEAVE independent.
5. **Cancel** — Cancel DRAFT OK; cancel ISSUED → 400.
6. **Audit** — Import apply, staff-schedule submit, PDF download appear in `/workspace/workforce/security/audit` with person/employment stamps on order rows.
7. **Templates** — Save az/ru HTML with `{{person.fullName}}`; PDF uses org override over holding/builtin.

## Out of scope

- Word designer, ƏMAS, MGMT book, FaceID.

## Org flags

| Flag | Default | Meaning |
|------|---------|---------|
| `organization.settings.workforce.requireOrderIssuedBeforeTerminate` | **off** | When `true`, terminate refuses until an ISSUED TERMINATE order exists for that employment. Pilot keeps this off so ops do not stall without printed əmr. **P1:** OWNER/HR_MANAGER toggle on `/workspace/workforce/personnel-orders` via `GET/PATCH …/personnel-orders/settings`. |

Employments list shows a **draft order** link chip when DRAFT personnel orders exist for that row. **P2:** template modal **Preview PDF** (`POST …/personnel-orders/templates/preview-pdf`) renders sample placeholders without creating/issuing an order. `CP-WF-ORD-02` stays **API**.

## Evidence

Three client blanks printed (hire, terminate, leave) per VÖEN. Status stays **API** in COVERAGE until UAT-SMOKE.
