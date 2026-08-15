# Security checklist — era-bank-core (MVP self-assessment)

Certification prep checklist for CBAR/FMN engagement. Not a substitute for external audit.

| Area | Verify | Status |
|------|--------|--------|
| Money path | All balance mutations via `kernel/posting-engine` only; no BullMQ money | ✓ |
| Kernel boundary | ESLint `kernel/*` must not import `modules/*` | ✓ |
| Idempotency | Postings, payments, card auth use idempotency keys | ✓ |
| Customer vs ops auth | `era-bank` ops JWT ≠ `era-bank-dbo` customer JWT | ✓ |
| PCI | Card PAN never stored; `cardToken` + `panLast4` only | ✓ |
| PII | CIF uses `globalPersonId`; no duplicate FIN in satellite DBs | ✓ |
| Service tokens | Engine routes require `Authorization: Bearer` service token | ✓ |
| EOD lock | External posts return **423 Locked** while EOD RUNNING (`allowDuringEod` for EOD-internal) | ✓ |
| JWT HMAC | HS256 signature verified; production never skips; optional `BANK_JWT_ALLOW_INSECURE_DEV=1` non-prod only | ✓ |
| Audit | Append-only `AuditLogEntry` on posting lifecycle | ✓ |
| Validation | Global `ValidationPipe` whitelist + forbidNonWhitelisted | ✓ |

## OWASP ZAP baseline (optional dev scan)

```bash
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://127.0.0.1:3210
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://127.0.0.1:3211
```

Document findings in release notes; fix High before production.
