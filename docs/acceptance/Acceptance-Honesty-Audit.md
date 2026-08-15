# Acceptance Honesty Audit (baseline)

**Date:** 2026-08-04  
**Canon:** ERA-Acceptance-Standard  
**Excluded from banned-phrase scan** (name listed in kit-config exclude_md_names).

## Findings

| Line | Observation | Action |
|------|-------------|--------|
| Clinic | Many CLI-* SHIPPED; fiscal/HL7 STUB | Scaffold 🟡; Sell not GA |
| Hotel | FO money / CL not Opera-depth; P5 open | Scaffold 🟡; Sell not GA |
| Platform | Workforce/MDM SHIPPED facts; field pilot open | edition mvp |
| Finance | Several FIN-* Status=API | UI/Demo not green; Sell not GA |
| Bank | Historical «Ops UX GA» prose | Prefer **ops-mvp**; edition yaml = mvp |
| Bank DBO / Logistics / Wholesale / Construction / Auto / Data Hub | Opened from stub to full matrices (W0) | Scaffold 🟡; Sell not GA |
| All | No `status: ga` in docs/editions while pilot_ready false | Enforced by scanner |

## Rule reminder

SHIPPED ≠ Scaffold ✅ ≠ Pilot-ready ≠ edition ga.
