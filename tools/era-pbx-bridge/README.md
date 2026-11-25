# era-pbx-bridge

AMI event forwarder + signed HTTP API for CRM telephony (TZ T-I20).

## Environment

| Variable | Purpose |
|----------|---------|
| `AMI_HOST`, `AMI_PORT` | Asterisk AMI (default port 5038) |
| `AMI_USER`, `AMI_SECRET` | AMI login |
| `CRM_WEBHOOK_URL` | CRM inbound webhook for call events |
| `BRIDGE_HMAC_SECRET` | HMAC for outbound posts and HTTP API |
| `BRIDGE_HTTP_PORT` | HTTP API port (default 5039) |
| `ORIGINATE_CONTEXT`, `ORIGINATE_CHANNEL_TMPL` | Originate dialplan (`PJSIP/{ext}`) |

## HTTP API

- `GET /health` — `{ ok, ami }` whether AMI socket is up
- `POST /originate` — body `{ fromExtension, to }`, header `x-era-signature: sha256(...)`  
  Returns **501** `AMI_NOT_READY` when AMI is not connected or `AMI_SECRET` is empty
- `GET /recording/:id` — **501** stub; recording fetch must be wired to your PBX/storage

## AMI Originate

The bridge issues `Action: Originate` on the shared AMI socket (`Async: true`).  
CLI smoke test:

```bash
node src/index.js originate 101 994501234567
```

## Recording fetch

Call recording URLs are **not** pulled by this bridge yet. Configure your PBX  
(MIXMONITOR, vendor API, or Mango/Mango-compatible recording id) and extend  
`GET /recording/:id` or forward `recordingUrl` in CRM webhook payloads.

## Events

`Newchannel`, `DialBegin` → `call.ringing`; `Hangup` / `DialEnd` → `call.ended` or `call.missed`.  
Forwarded to `CRM_WEBHOOK_URL` with `x-era-signature`.