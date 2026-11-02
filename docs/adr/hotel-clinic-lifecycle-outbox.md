# Hotel → clinic lifecycle outbox

## Decision

Check-in, check-out, early depart, package change, room change, and a guest move write a row in `clinic_lifecycle_outbox` on the hotel before the HTTP call. The row keeps one `correlationId` until the payload changes. A drain every 15 seconds resends until the orchestrator accepts the event. The clinic ignores a second delivery of the same `correlationId`.

The organization on the row is the stay's `organizationId`.

## Reconcile

The clinic process calls the stay reconcile at 06:00 and 18:00 Asia/Baku, and once 20 seconds after boot. `POST /api/cron/episode-hotel-checkout` runs the same pass.

The hotel snapshot lists in-house guests who have a medical package, and which of the clinic's open reservation ids are already `CHECKED_OUT`. The clinic opens a missing course, closes a checked-out or departed guest, and copies package, room, name, sex, and birth date onto an open course. A guest without a medical package is not created. The planned departure date does not close a course.

## Consequences

A lost publish is retried in seconds. A crash after the stay is saved and before the outbox row is written is repaired at the next 06:00, 18:00, or process start. Package and room changes still travel on the live event; the reconcile repeats them when that event was lost.
