# Platform channels harden — lab evidence (2026-11-05)

**Scope:** ERP Channel Hub harden (CP-CHANNELS → sync + money gate + shared links).  
**Status:** Lab partial — **not** Pilot-ready / **not** SHIPPED / AC-CP-CHANNELS stays 🟡.

## Automated proof (this change)

| Check | Evidence |
|-------|----------|
| Sync after entitlement-style set yields self `REVENUE_EVENT` | `cp-channels-negative.spec.ts` — connect finance + OWN self REVENUE |
| Suspend finance drops PLATFORM revenue; ACCEPTOR untouched | `cp-channels-negative.spec.ts` — suspend finance_core |
| Billing module-change also syncs channels (best-effort) | `billing-satellite-notify.spec.ts` |
| Money allowlist gate (unknown skip / money fail-closed) | `packages/satellite-kit` `satellite-channels.test.ts` |
| Admin resync APIs | `POST …/channels/resync`, `POST …/channels/resync-all` + SA Resync button |
| Hotel `/admin/links` SETTINGS (not SCREEN_ADMIN) | `hotel-page-route-inventory.spec.ts` + `HotelOpsShell` settings nav |
| Money assert before mutate | F&B pay/Z-close; retail PAID/return/hub-settle/Z-close (+ `RETAIL_SHIFT_CLOSED` allowlist); clinic visit/procedure/lab COMPLETED + hub visit settle; room-charge skips revenue event |
| Hotel channel-disabled → 403 | `era-hotel-pms/src/lib/api-utils.ts` `SatelliteChannelDisabledError` |

## UAT-SMOKE UI (lab — open for human sign)

See `era-orchestrator/doc/UAT-SMOKE-PLATFORM.md` § CP-CHANNELS harden.

1. SA org Channels → Resync → FOLIO/SETTLEMENT/REVENUE appear when entitlements exist.
2. Hotel or Finance disables inbound → retail/clinic/F&B matching call fails closed.
3. Connect `finance_core` on STANDALONE → self `REVENUE_EVENT` without mode re-save (also covered by unit + billing notify).
4. Suspend industry sat → PLATFORM guest edges leave desired set on sync.

**Signed:** automated unit paths only (2026-11-05). Human UI walk still open — do not flip Scaffold ✅ / SHIPPED.
