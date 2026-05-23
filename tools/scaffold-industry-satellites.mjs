#!/usr/bin/env node
/**
 * Scaffolds industry satellite Next.js apps (MVP shell + docs + Docker).
 * Usage: node tools/scaffold-industry-satellites.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const SATELLITES = [
  {
    dir: "era-retail-pos",
    name: "era-retail-pos",
    title: "ERA Retail POS",
    port: 3300,
    host: "retail.era.az",
    db: "era_retail_pos",
    slug: "industry_retail_ecom",
    delivery: "DELIVERY-RETAIL",
    tagline: "POS with grocery, apparel, electronics, pharmacy presets",
    homePath: "/pos",
    presets: true,
  },
  {
    dir: "era-logistics",
    name: "era-logistics",
    title: "ERA Logistics",
    port: 3301,
    host: "logistics.era.az",
    db: "era_logistics",
    slug: "industry_logistics_customs",
    delivery: "DELIVERY-LOGISTICS",
    tagline: "Fleet, trips, POD",
    homePath: "/trips",
  },
  {
    dir: "era-construction",
    name: "era-construction",
    title: "ERA Construction",
    port: 3302,
    host: "construction.era.az",
    db: "era_construction",
    slug: "industry_construction",
    delivery: "DELIVERY-CONSTRUCTION",
    tagline: "Sites, BOQ, progress acts",
    homePath: "/projects",
  },
  {
    dir: "era-crm-field",
    name: "era-crm-field",
    title: "ERA CRM Field",
    port: 3303,
    host: "crm.era.az",
    db: "era_crm_field",
    slug: "industry_crm_whatsapp",
    delivery: "DELIVERY-CRM",
    tagline: "Leads, visits, WhatsApp pre-sale (not Finance counterparty MDM)",
    homePath: "/leads",
  },
  {
    dir: "era-auto-sto",
    name: "era-auto-sto",
    title: "ERA Auto STO",
    port: 3304,
    host: "auto.era.az",
    db: "era_auto_sto",
    slug: "industry_auto_sto",
    delivery: "DELIVERY-AUTO",
    tagline: "Work orders, labor, parts",
    homePath: "/work-orders",
  },
  {
    dir: "era-wholesale",
    name: "era-wholesale",
    title: "ERA Wholesale",
    port: 3305,
    host: "wholesale.era.az",
    db: "era_wholesale",
    slug: "industry_wholesale",
    delivery: "DELIVERY-WHOLESALE",
    tagline: "B2B orders, credit limits, picking",
    homePath: "/orders",
  },
  {
    dir: "era-clinic",
    name: "era-clinic",
    title: "ERA Clinic",
    port: 3306,
    host: "clinic.era.az",
    db: "era_clinic",
    slug: "industry_clinic",
    delivery: "DELIVERY-CLINIC",
    tagline: "Appointments, visits, services",
    homePath: "/appointments",
  },
];

function w(filePath, content) {
  const full = path.join(root, filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  console.log("wrote", filePath);
}

for (const s of SATELLITES) {
  const base = s.dir;

  w(
    `${base}/package.json`,
    JSON.stringify(
      {
        name: s.name,
        version: "0.1.0",
        private: true,
        description: s.tagline,
        scripts: {
          dev: `next dev -p ${s.port}`,
          build: "prisma generate && next build",
          start: `next start -p ${s.port}`,
          lint: "next lint",
          "db:generate": "prisma generate",
          "db:push": "prisma db push",
        },
        dependencies: {
          "@era/contracts": "file:../packages/era-contracts",
          "@era/satellite-kit": "file:../packages/satellite-kit",
          "@prisma/client": "^6.9.0",
          next: "^15.3.3",
          react: "^19.1.0",
          "react-dom": "^19.1.0",
          zod: "^3.25.36",
        },
        devDependencies: {
          "@types/node": "^22.15.21",
          "@types/react": "^19.1.4",
          "@types/react-dom": "^19.1.5",
          prisma: "^6.9.0",
          typescript: "^5.7.3",
        },
      },
      null,
      2,
    ) + "\n",
  );

  w(
    `${base}/tsconfig.json`,
    `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,
  );

  w(
    `${base}/next.config.ts`,
    `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
};

export default nextConfig;
`,
  );

  w(`${base}/next-env.d.ts`, `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n`);

  w(
    `${base}/.gitignore`,
    `node_modules/
.next/
.env
.env.local
*.log
`,
  );

  w(
    `${base}/.env.example`,
    `DATABASE_URL=postgresql://era:era_dev_password@localhost:5432/${s.db}?schema=public
PORT=${s.port}
ORCHESTRATOR_EVENT_URL=http://localhost:4100
SATELLITE_EVENT_SERVICE_TOKEN=dev-satellite-event-token
ERA_SATELLITE_ORGANIZATION_ID=demo-org
`,
  );

  w(
    `${base}/prisma/schema.prisma`,
    `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String
  createdAt DateTime @default(now())
  outlets   Outlet[]
}

model Outlet {
  id        String   @id @default(cuid())
  tenantId  String
  code      String
  name      String
  preset    String?
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  createdAt DateTime @default(now())

  @@unique([tenantId, code])
}
`,
  );

  w(
    `${base}/src/lib/prisma.ts`,
    `import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
`,
  );

  w(
    `${base}/app/layout.tsx`,
    `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Segoe UI, sans-serif", margin: 0, padding: "1rem" }}>
        <header style={{ marginBottom: "1rem", borderBottom: "1px solid #D5DADF" }}>
          <strong>${s.title}</strong>
        </header>
        {children}
      </body>
    </html>
  );
}
`,
  );

  w(
    `${base}/app/page.tsx`,
    `import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>${s.title}</h1>
      <p>${s.tagline}</p>
      <ul>
        <li><Link href="/api/health">Health API</Link></li>
        <li><Link href="${s.homePath}">Main screen (MVP shell)</Link></li>
      </ul>
    </main>
  );
}
`,
  );

  w(
    `${base}/app${s.homePath}/page.tsx`,
    `export default function MainScreen() {
  return (
    <main>
      <h1>MVP shell — ${s.title}</h1>
      <p>Operational UI placeholder. See doc/${s.delivery}.md for delivery tracker.</p>
    </main>
  );
}
`,
  );

  w(
    `${base}/app/api/health/route.ts`,
    `import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, service: "${s.name}" });
}
`,
  );

  w(
    `${base}/app/api/events/dispatch/route.ts`,
    `import { NextResponse } from "next/server";
import { publishToOrchestratorGateway, satelliteOrganizationId } from "@era/satellite-kit";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const body = (await req.json()) as { type: string; payload?: Record<string, unknown> };
  const event = {
    type: body.type,
    organizationId: satelliteOrganizationId(),
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
    payload: body.payload ?? {},
  };
  const result = await publishToOrchestratorGateway(event);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, event });
}
`,
  );

  w(
    `${base}/Dockerfile`,
    `# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl wget

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
USER nextjs
EXPOSE ${s.port}
ENV PORT=${s.port}
ENV HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \\
  CMD wget -qO- http://127.0.0.1:${s.port}/api/health || exit 1
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
`,
  );

  w(`${base}/public/.gitkeep`, "");

  w(
    `${base}/docker-entrypoint.sh`,
    `#!/bin/sh
set -e
cd /app
if [ -f prisma/schema.prisma ]; then
  npx prisma generate 2>/dev/null || true
  npx prisma db push 2>/dev/null || true
fi
exec "$@"
`,
  );

  w(`${base}/.dockerignore`, `node_modules\n.next\n.git\n.env*\n`);

  w(
    `${base}/README.md`,
    `# ${s.title}

${s.tagline}

- Host: \`${s.host}\` (port ${s.port})
- Entitlement: \`${s.slug}\`
- Docs: [PRD](./PRD.md) · [DELIVERY](./doc/${s.delivery}.md)

\`\`\`bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
\`\`\`
`,
  );

  w(
    `${base}/PRD.md`,
    `# ${s.title} — PRD

## §1 Vision

${s.tagline}. Operational satellite; GL and counterparty master data live in **era-finance-core**.

## §3 Modules

| Module | Status |
|--------|--------|
| MVP shell | IN_PROGRESS |
| Orchestrator events | PLANNED |
| SSO exchange | PLANNED |

## §5 Integrations

- Outbound: \`POST /api/v1/satellite-events\` via orchestrator
- Finance: invoice/stock via event worker (no direct GL in satellite)

## §7 Changelog

| Date | Note |
|------|------|
| 2026-05-23 | Initial scaffold |
`,
  );

  w(
    `${base}/TZ.md`,
    `# ${s.title} — TZ

- Stack: Next.js 15, Prisma 6, PostgreSQL
- Port: ${s.port}
- DB: \`${s.db}\`
- Shared: \`@era/contracts\`, \`@era/satellite-kit\`
`,
  );

  w(
    `${base}/doc/${s.delivery}.md`,
    `# ${s.delivery}

## Stage 0 — Docs & scaffold
- [x] PRD.md / TZ.md
- [x] Next.js + Prisma scaffold
- [ ] SSO exchange

## Stage 1 — MVP shell
- [x] Health API
- [x] Main screen placeholder
- [ ] Event dispatch E2E with orchestrator
`,
  );

  w(
    `${base}/doc/UAT-SMOKE.md`,
    `# UAT smoke — ${s.name}

- [ ] \`GET /api/health\` → 200
- [ ] Home page loads
- [ ] \`POST /api/events/dispatch\` (with orchestrator running)
`,
  );

  w(
    `${base}/doc/DOCUMENTATION-INDEX.md`,
    `# Documentation index

- [PRD](../PRD.md)
- [TZ](../TZ.md)
- [DELIVERY](./${s.delivery}.md)
- [UAT-SMOKE](./UAT-SMOKE.md)
- [00-vision](./clone-spec/00-vision-and-boundaries.md)
- [01-finance-boundary](./clone-spec/01-finance-boundary.md)
`,
  );

  w(
    `${base}/doc/clone-spec/00-vision-and-boundaries.md`,
    `# Vision & boundaries — ${s.title}

Operations in this app. Accounting in era-finance-core.
`,
  );

  w(
    `${base}/doc/clone-spec/01-finance-boundary.md`,
    `# Finance boundary

- Catalog, GL, CRM counterparty, WhatsApp invoice delivery → **finance-core**
- This satellite emits typed events only.
`,
  );

  if (s.presets) {
    for (const p of ["grocery", "apparel", "electronics", "pharmacy"]) {
      w(`${base}/doc/presets/${p}.md`, `# Preset: ${p}\n\nSee PRD. Retail preset configuration on \`Outlet.preset\`.\n`);
    }
  }
}

console.log("Done scaffolding", SATELLITES.length, "satellites");
