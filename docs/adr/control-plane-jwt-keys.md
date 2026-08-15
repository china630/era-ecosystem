# ADR: Control-plane JWT keys (ERA_JWT_SECRET + RS256/JWKS)

**Status:** Accepted  
**Date:** 2026-07-19  
**Context:** Finance SSO from Orchestrator was fragile: expired CP access tokens were passed as legacy `?token=`, handoff tickets lived in an in-memory Map (lost on restart), and `provisionFromControlPlane` verified CP tokens with Finance-local `JWT_SECRET` instead of the shared CP verifier. `JWT_SECRET` was also overloaded as a fallback for PII encryption, audit hashing, and signing.

## Decision

1. **Single auth anchor:** `ERA_JWT_SECRET` is the only HS256 secret for Orchestrator-issued access tokens and for Finance-local session JWTs. Variable `JWT_SECRET` is removed from Finance compose and code.
2. **CP verify path:** Finance `provisionFromControlPlane` uses `verifyControlPlaneAccessToken` (issuer / audience / HS256 / RS256+JWKS), same as `ControlPlaneAuthGuard`.
3. **Handoff:** Orchestrator launcher refreshes the CP access token before minting a Finance handoff ticket. Legacy `?token=` is used only when the access token is still valid; otherwise the UI forces re-login. Handoff tickets are stored in Redis (TTL 60s, one-time `GETDEL`). Finance web keeps the redeemed CP access/refresh tokens for `/cp/*` billing proxies and mints a separate Finance-local session JWT — never send the Finance JWT to Orchestrator (different `sub` identity store). A CP 401 must not wipe the Finance ERP session.
4. **RS256 dual cutover:** Orchestrator `ERA_JWT_SIGNING_MODE=dual` with `ERA_JWT_RS256_JWK` / `ERA_JWT_RS256_JWK_FILE`. `verifyAccessToken` accepts HS256 and RS256. Finance `ERA_JWT_VERIFY_MODE=dual` + `ERA_JWT_JWKS_URL=http://orchestrator:4000/.well-known/jwks.json`.
5. **Dedicated data keys (independent lifecycle from auth):** `PII_ENCRYPTION_KEY`, `PII_BLIND_INDEX_KEY`, `AUDIT_HASH_SECRET`. Optional signing secrets (`INVITE_TOKEN_SECRET`, `INVOICE_PORTAL_TOKEN_SECRET`, `PAYROLL_EXPORT_SIGN_SECRET`, `PAYMENT_WEBHOOK_SECRET`) fall back to `ERA_JWT_SECRET` when unset — never to a removed `JWT_SECRET`.

## Consequences

- Rotating `ERA_JWT_SECRET` no longer silently re-keys PII/blind indexes.
- Compromising a satellite still should not grant signing rights once cutover completes to `rs256` (private JWK only on Orchestrator).
- Empty Finance DB / Nafta-only: re-provision org after PII key change; no ciphertext migration needed at point-zero.
- Industry satellites keep `AUTH_JWT_SECRET` for local staff sessions; CP JWKS adoption for them is a later wave.

## Related

- [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md)
- [ECOSYSTEM_URLS.md](../ECOSYSTEM_URLS.md)
