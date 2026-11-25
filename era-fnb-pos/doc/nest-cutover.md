# F&B API cutover (Next route handlers to Nest)

HTTP edge only. Algorithms stay in services. UI stays on Next.

Domain routes are Nest controllers in `nest/native/controllers/`. `npm run nest` uses `tsconfig.nest.json`. There is no generator and no `nest/generated`.

Kit bind, runtime-config, and billing-status are `KitApiController` methods. They pass Express headers and the parsed body. Cookie and locale responses write `Set-Cookie` on the Express response. Permission denials and route errors return `{ status, body }` through `sendJson`. Handlers do not build a Web Response.

- Generated route table is gone (169 methods lifted).
- Nest listens on `NEST_PORT` (default 13202) at `127.0.0.1`. Public port stays 3202.
