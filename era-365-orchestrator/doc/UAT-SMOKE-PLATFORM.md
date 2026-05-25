# UAT smoke — Platform APIs (orchestrator :4100)

See billing reconcile: `npm run platform:billing-reconcile` from era-365-orchestrator root.

Payment webhooks production URL: `POST https://<cp-host>/v1/billing/webhooks/pasha_bank` and `/drakaris`.

Notifications: `POST /platform/notifications/v1/send` with Owner JWT.

Finance: `ERA_NOTIFICATIONS_PACK=true` routes invoice email via Pack.
