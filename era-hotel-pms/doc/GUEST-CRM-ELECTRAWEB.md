# Guest CRM — ElektraWeb parity audit (Nafta P3)

Signed audit table for H-BL-26 enablement. P2/P3 buttons enabled in `guest-crm-config.ts` where hotel owns data.

| button_id | Nafta class | ERA route / module | Status |
|-----------|-------------|-------------------|--------|
| interests_hobbies | P2 | `/guests/{id}/interests` | **Enabled** — `GuestCrmExtension.interestsJson` |
| social_media | P2 | `/guests/{id}/social-media` | **Enabled** — `GuestCrmExtension.socialMediaJson` |
| general_crm | P2 | `/guests/{id}/general-crm` | **Enabled** — `GuestCrmExtension.generalCrmNotes` |
| send_emails | P2 | `/guests/{id}/emails` | **Enabled** — platform notify (H-BL-06); vendor STUB |
| send_sms | P2 | `/guests/{id}/sms` | **Enabled** — platform notify (H-BL-06); vendor STUB |
| contact_logs | P2 | `/guests/{id}/contact-logs` | **Enabled** |
| membership_agreements | P2 | `/guests/{id}/membership-agreements` | **Enabled** — `GuestTimeShareAgreement` |
| buying_habits | P2 | fb-pos deep link | **Enabled** when `ERA_FNB_POS_URL` set |
| group_hotels_visiting | P2 | `/reports/group-reservations` | **Enabled** |
| references | P3 | — | **Deferred** — external refs API |
| external_reviews | P3 | — | **Deferred** — review aggregator |
| mobile_chat | P3 | — | **Deferred** — chat vendor |
| login_devices | P3 | — | **Deferred** — device registry |
| other_hotels_visited | P3 | — | **Deferred** — chain PMS |
| web_call_requests | P2 | — | **Deferred** — PBX integration |
| calls | P2 | — | **Deferred** — PBX CDR |
| auto_tasks | P2 | — | **Deferred** — rules engine |

## Ops workflow

1. Nafta FO reviews this table in UAT and marks must-have overrides.
2. Enabled buttons appear on Guest Card CRM tab without `disabledReasonKey`.
3. P3 defer items stay documented until vendor API available.

See also: [FRONT-OFFICE-ELECTRAWEB.md](./FRONT-OFFICE-ELECTRAWEB.md), [BACKLOG-PRODUCTION.md](./BACKLOG-PRODUCTION.md) § P3.
