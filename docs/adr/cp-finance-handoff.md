# ADR: Control-plane JWT handoff to Finance web

**Status:** Accepted (Post-SP9 P3)  
**Date:** 2026-05-26

## Context

Orchestrator is the single platform entry (`:3100`). Finance remains the data plane for GL, holding, and NAS. Platform users open Finance from the Orch home tile without a second password when `ERA_AUTH_MODE=control-plane`.

## Decision

1. Orch stores the CP `accessToken` in `localStorage` (`era_orch_access_token`).
2. Orch web calls `POST /auth/finance-handoff` → one-time `ticket` (60s TTL).
3. Finance tile opens `{FINANCE_WEB}/auth/cp-handoff?ticket=...` (legacy `?token=` deprecated).
4. Finance web redeems ticket via `POST /auth/finance-handoff/redeem` → access token → session.
4. Unauthenticated `/login` on Finance redirects to `{ORCH_WEB}/login?next=finance`.

## Security

| Risk | Mitigation |
|------|------------|
| Token in query string | HTTPS in production; short-lived JWT; prefer one-time ticket in CP2 |
| Token leakage via Referer | Finance handoff uses `router.replace` immediately after login |
| Wrong audience | Finance API trusts Orch JWT only when `ERA_AUTH_MODE=control-plane` |

## Alternatives considered

- HMAC SSO like industry satellites — rejected for Finance (same CP user, not operational satellite session).
- Separate Finance login forever — rejected (poor UX for owners).

## Consequences

- Finance `/industry/*`, `/register*`, `/super-admin/*` redirect to Orch (middleware).
- Industry early-access modal lives on Orch only (P4).
