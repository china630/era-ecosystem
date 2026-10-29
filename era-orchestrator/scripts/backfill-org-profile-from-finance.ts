/**
 * CP-ORG-PROFILE-01 — one-time backfill of orch OrganizationProfile from Finance,
 * then optional hotel/clinic fill for empty fields only.
 *
 * Usage (from era-orchestrator/):
 *   npx tsx scripts/backfill-org-profile-from-finance.ts
 *   npx tsx scripts/backfill-org-profile-from-finance.ts --apply
 *   npx tsx scripts/backfill-org-profile-from-finance.ts --apply --org=<uuid>
 *   npx tsx scripts/backfill-org-profile-from-finance.ts --apply --with-satellites
 *
 * Env:
 *   DATABASE_URL                 orch control-plane (required)
 *   FINANCE_DATABASE_URL         finance DB (or FINANCE_RO_DATABASE_URL)
 *   FINANCE_PUBLIC_URL           optional absolute origin for `/files/...` logos
 *                                (aliases: ERA_FINANCE_WEB_URL, NEXT_PUBLIC_FINANCE_WEB_URL)
 *   HOTEL_DATABASE_URL           optional, with --with-satellites
 *   CLINIC_DATABASE_URL          optional, with --with-satellites
 *
 * Default is dry-run (no writes). Pass --apply to mutate orch.
 */
import { config as loadDotenv } from "dotenv";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { Pool, type PoolClient } from "pg";
import {
  emptyCounters,
  formatBankLine,
  planProfileFill,
  resolveLogoUrlForCp,
  type BackfillCounters,
  type ExistingProfileState,
  type ProfileSeed,
} from "./lib/org-profile-backfill";

for (const envPath of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "era-orchestrator", ".env"),
]) {
  if (fs.existsSync(envPath)) loadDotenv({ path: envPath, override: false });
}

type Args = {
  apply: boolean;
  withSatellites: boolean;
  orgId: string | null;
};

function parseArgs(argv: string[]): Args {
  let apply = false;
  let withSatellites = false;
  let orgId: string | null = null;
  for (const a of argv) {
    if (a === "--apply") apply = true;
    else if (a === "--with-satellites") withSatellites = true;
    else if (a === "--dry-run") apply = false;
    else if (a.startsWith("--org=")) orgId = a.slice("--org=".length).trim() || null;
  }
  return { apply, withSatellites, orgId };
}

function requireUrl(name: string, value: string | undefined): string {
  const v = value?.trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function loadExisting(
  orch: PoolClient,
  organizationId: string,
): Promise<ExistingProfileState> {
  const profile = await orch.query<{
    director_name: string | null;
    logo_url: string | null;
    bank_line: string | null;
  }>(
    `SELECT director_name, logo_url, bank_line
     FROM organization_profiles WHERE organization_id = $1`,
    [organizationId],
  );
  const contacts = await orch.query<{ kind: string }>(
    `SELECT kind FROM organization_contact_channels WHERE organization_id = $1`,
    [organizationId],
  );
  const addresses = await orch.query<{ kind: string }>(
    `SELECT kind FROM organization_addresses
     WHERE organization_id = $1 AND kind = 'LEGAL'`,
    [organizationId],
  );
  const kinds = new Set(contacts.rows.map((r) => r.kind));
  const row = profile.rows[0];
  return {
    hasProfile: Boolean(row),
    directorName: row?.director_name ?? null,
    logoUrl: row?.logo_url ?? null,
    bankLine: row?.bank_line ?? null,
    hasPhone: kinds.has("PHONE") || kinds.has("MOBILE"),
    hasEmail: kinds.has("EMAIL"),
    hasWebsite: kinds.has("WEBSITE"),
    hasLegalAddress: addresses.rows.length > 0,
  };
}

async function ensureProfile(
  orch: PoolClient,
  organizationId: string,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  await orch.query(
    `INSERT INTO organization_profiles (organization_id, created_at, updated_at)
     VALUES ($1, NOW(), NOW())
     ON CONFLICT (organization_id) DO NOTHING`,
    [organizationId],
  );
}

function mergeExistingAfterPlan(
  existing: ExistingProfileState,
  plan: ReturnType<typeof planProfileFill>,
): ExistingProfileState {
  return {
    hasProfile: true,
    directorName:
      existing.directorName ?? plan.profilePatch.directorName ?? null,
    logoUrl: existing.logoUrl ?? plan.profilePatch.logoUrl ?? null,
    bankLine: existing.bankLine ?? plan.profilePatch.bankLine ?? null,
    hasPhone: existing.hasPhone || Boolean(plan.createPhone),
    hasEmail: existing.hasEmail || Boolean(plan.createEmail),
    hasWebsite: existing.hasWebsite || Boolean(plan.createWebsite),
    hasLegalAddress: existing.hasLegalAddress || Boolean(plan.createLegal),
  };
}

async function applyPlan(
  orch: PoolClient,
  organizationId: string,
  existing: ExistingProfileState,
  seed: ProfileSeed,
  counters: BackfillCounters,
  dryRun: boolean,
  source: string,
  logoMeta?: { skipDataUrl?: boolean; skipRelative?: boolean },
): Promise<ExistingProfileState> {
  const plan = planProfileFill(existing, seed, logoMeta);
  if (plan.skipDataUrlLogo) {
    counters.skippedDataUrlLogo += 1;
    console.info(`[skip_data_url_logo] ${organizationId} source=${source}`);
  }
  if (plan.skipRelativeLogo) {
    counters.skippedRelativeLogo += 1;
    console.info(
      `[skip_relative_logo] ${organizationId} source=${source} (set FINANCE_PUBLIC_URL to absolutize /files/…)`,
    );
  }
  if (!plan.hasAnySeed) {
    counters.skippedNoSource += 1;
    return existing;
  }
  if (!plan.hasAnyWrite) {
    // Unusable logo-only seed must not look like "already filled".
    if (
      plan.hasNonLogoSeed ||
      !(plan.skipDataUrlLogo || plan.skipRelativeLogo)
    ) {
      counters.skippedExisting += 1;
      console.info(`[skipped_existing] ${organizationId} source=${source}`);
    }
    return existing;
  }

  const writes: string[] = [];
  if (plan.profilePatch.directorName) writes.push("directorName");
  if (plan.profilePatch.logoUrl) writes.push("logoUrl");
  if (plan.profilePatch.bankLine) writes.push("bankLine");
  if (plan.createPhone) writes.push("PHONE");
  if (plan.createEmail) writes.push("EMAIL");
  if (plan.createWebsite) writes.push("WEBSITE");
  if (plan.createLegal) writes.push("LEGAL");

  console.info(
    `[${dryRun ? "dry_fill" : "filled"}] ${organizationId} source=${source} fields=${writes.join(",")}`,
  );

  const next = mergeExistingAfterPlan(existing, plan);

  if (dryRun) {
    counters.filled += 1;
    counters.fieldsWritten += writes.length;
    return next;
  }

  await orch.query("BEGIN");
  try {
    await ensureProfile(orch, organizationId, false);

    const patch = plan.profilePatch;
    if (Object.keys(patch).length > 0) {
      await orch.query(
        `UPDATE organization_profiles SET
           director_name = COALESCE(director_name, $2),
           logo_url = COALESCE(logo_url, $3),
           bank_line = COALESCE(bank_line, $4),
           updated_at = NOW()
         WHERE organization_id = $1`,
        [
          organizationId,
          patch.directorName ?? null,
          patch.logoUrl ?? null,
          patch.bankLine ?? null,
        ],
      );
    }

    if (plan.createPhone) {
      await orch.query(
        `INSERT INTO organization_contact_channels
           (id, organization_id, kind, value, purpose, is_primary, sort_order, created_at, updated_at)
         VALUES ($1, $2, 'PHONE', $3, 'GENERAL', true, 0, NOW(), NOW())`,
        [randomUUID(), organizationId, plan.createPhone],
      );
    }
    if (plan.createEmail) {
      await orch.query(
        `INSERT INTO organization_contact_channels
           (id, organization_id, kind, value, purpose, is_primary, sort_order, created_at, updated_at)
         VALUES ($1, $2, 'EMAIL', $3, 'GENERAL', true, 0, NOW(), NOW())`,
        [randomUUID(), organizationId, plan.createEmail],
      );
    }
    if (plan.createWebsite) {
      await orch.query(
        `INSERT INTO organization_contact_channels
           (id, organization_id, kind, value, purpose, is_primary, sort_order, created_at, updated_at)
         VALUES ($1, $2, 'WEBSITE', $3, 'GENERAL', true, 0, NOW(), NOW())`,
        [randomUUID(), organizationId, plan.createWebsite],
      );
    }
    if (plan.createLegal) {
      await orch.query(
        `INSERT INTO organization_addresses
           (id, organization_id, kind, line1, line_az, line_ru, line_en, country, is_primary, sort_order, created_at, updated_at)
         VALUES ($1, $2, 'LEGAL', $3, $4, $5, $6, 'AZ', true, 0, NOW(), NOW())`,
        [
          randomUUID(),
          organizationId,
          plan.createLegal.line1,
          plan.createLegal.lineAz,
          plan.createLegal.lineRu,
          plan.createLegal.lineEn,
        ],
      );
    }
    await orch.query("COMMIT");
  } catch (err) {
    await orch.query("ROLLBACK").catch(() => undefined);
    throw err;
  }

  counters.filled += 1;
  counters.fieldsWritten += writes.length;
  return next;
}

type FinanceRow = {
  id: string;
  legal_address: string | null;
  phone: string | null;
  director_name: string | null;
  logo_url: string | null;
  bank_name: string | null;
  account_number: string | null;
  currency: string | null;
  iban: string | null;
  swift: string | null;
};

function financePublicBase(): string | null {
  return (
    process.env.FINANCE_PUBLIC_URL?.trim() ||
    process.env.ERA_FINANCE_WEB_URL?.trim() ||
    process.env.NEXT_PUBLIC_FINANCE_WEB_URL?.trim() ||
    null
  );
}

async function loadFinanceSeed(
  finance: Pool,
  organizationId: string,
): Promise<{
  seed: ProfileSeed;
  logoMeta: { skipDataUrl?: boolean; skipRelative?: boolean };
} | null> {
  const res = await finance.query<FinanceRow>(
    `SELECT o.id,
            o.legal_address,
            o.phone,
            o.director_name,
            o.logo_url,
            b.bank_name,
            b.account_number,
            b.currency,
            b.iban,
            b.swift
     FROM organizations o
     LEFT JOIN LATERAL (
       SELECT bank_name, account_number, currency, iban, swift
       FROM organization_bank_accounts
       WHERE organization_id = o.id
         AND deleted_at IS NULL
         AND COALESCE(is_archived, false) = false
       ORDER BY is_primary DESC, created_at ASC
       LIMIT 1
     ) b ON true
     WHERE o.id = $1`,
    [organizationId],
  );
  const row = res.rows[0];
  if (!row) return null;
  const logo = resolveLogoUrlForCp(row.logo_url, {
    financePublicBase: financePublicBase(),
  });
  return {
    seed: {
      directorName: row.director_name,
      logoUrl: logo.url ?? null,
      bankLine: formatBankLine({
        bankName: row.bank_name,
        accountNumber: row.account_number,
        currency: row.currency,
        iban: row.iban,
        swift: row.swift,
      }),
      phone: row.phone,
      legalAddress: row.legal_address,
    },
    logoMeta: {
      skipDataUrl: logo.skipDataUrl,
      skipRelative: logo.skipRelative,
    },
  };
}

type HotelRow = {
  organization_id: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

async function loadHotelSeeds(
  hotel: Pool,
  orgFilter: string | null,
): Promise<Map<string, ProfileSeed>> {
  // HotelProfile columns are Prisma camelCase (no @@map).
  const res = await hotel.query<HotelRow>(
    `SELECT DISTINCT ON ("organizationId")
            "organizationId" AS organization_id,
            address,
            phone,
            email,
            website
     FROM "HotelProfile"
     WHERE ($1::text IS NULL OR "organizationId" = $1)
     ORDER BY "organizationId",
              (CASE WHEN phone IS NOT NULL AND phone <> '' THEN 0 ELSE 1 END),
              (CASE WHEN address IS NOT NULL AND address <> '' THEN 0 ELSE 1 END),
              "createdAt" ASC`,
    [orgFilter],
  );
  const map = new Map<string, ProfileSeed>();
  for (const row of res.rows) {
    map.set(row.organization_id, {
      phone: row.phone,
      email: row.email,
      website: row.website,
      legalAddress: row.address,
      // logoPath is filesystem-relative — never copy into orch logoUrl
    });
  }
  return map;
}

type ClinicRow = {
  organization_id: string;
  print_phone: string | null;
  print_email: string | null;
  print_website: string | null;
  print_address_en: string | null;
  print_address_ru: string | null;
  print_address_az: string | null;
  print_logo_data_url: string | null;
};

async function loadClinicSeeds(
  clinic: Pool,
  orgFilter: string | null,
): Promise<Map<string, ProfileSeed>> {
  // Tenant.organizationId is camelCase; print_* columns use @map snake_case.
  const res = await clinic.query<ClinicRow>(
    `SELECT "organizationId" AS organization_id,
            print_phone,
            print_email,
            print_website,
            print_address_en,
            print_address_ru,
            print_address_az,
            print_logo_data_url
     FROM "Tenant"
     WHERE ($1::text IS NULL OR "organizationId" = $1)`,
    [orgFilter],
  );
  const map = new Map<string, ProfileSeed>();
  for (const row of res.rows) {
    // Prefer first tenant per org if multiple (rare); first write wins via Map set.
    if (map.has(row.organization_id)) continue;
    map.set(row.organization_id, {
      phone: row.print_phone,
      email: row.print_email,
      website: row.print_website,
      addressEn: row.print_address_en,
      addressRu: row.print_address_ru,
      addressAz: row.print_address_az,
      // data-URL logos intentionally passed through so planProfileFill can count skip
      logoUrl: row.print_logo_data_url,
    });
  }
  return map;
}

async function listOrchOrgIds(
  orch: PoolClient,
  orgFilter: string | null,
): Promise<string[]> {
  const res = await orch.query<{ id: string }>(
    `SELECT id::text AS id FROM organizations
     WHERE ($1::uuid IS NULL OR id = $1::uuid)
     ORDER BY created_at ASC`,
    [orgFilter],
  );
  return res.rows.map((r) => r.id);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = !args.apply;
  const orchUrl = requireUrl("DATABASE_URL", process.env.DATABASE_URL);
  const financeUrl =
    process.env.FINANCE_DATABASE_URL?.trim() ||
    process.env.FINANCE_RO_DATABASE_URL?.trim();
  if (!financeUrl) {
    throw new Error(
      "FINANCE_DATABASE_URL or FINANCE_RO_DATABASE_URL is required",
    );
  }

  const orchPool = new Pool({ connectionString: orchUrl });
  const financePool = new Pool({ connectionString: financeUrl });
  let hotelPool: Pool | null = null;
  let clinicPool: Pool | null = null;

  if (args.withSatellites) {
    const hotelUrl = process.env.HOTEL_DATABASE_URL?.trim();
    const clinicUrl = process.env.CLINIC_DATABASE_URL?.trim();
    if (!hotelUrl && !clinicUrl) {
      throw new Error(
        "--with-satellites requires HOTEL_DATABASE_URL and/or CLINIC_DATABASE_URL",
      );
    }
    if (hotelUrl) hotelPool = new Pool({ connectionString: hotelUrl });
    if (clinicUrl) clinicPool = new Pool({ connectionString: clinicUrl });
  }

  const counters = emptyCounters();
  const orch = await orchPool.connect();

  try {
    console.info(
      `[org-profile-backfill] mode=${dryRun ? "dry-run" : "APPLY"} orgFilter=${args.orgId ?? "*"} satellites=${args.withSatellites}`,
    );

    const orgIds = await listOrchOrgIds(orch, args.orgId);
    let hotelSeeds = new Map<string, ProfileSeed>();
    let clinicSeeds = new Map<string, ProfileSeed>();
    if (hotelPool) hotelSeeds = await loadHotelSeeds(hotelPool, args.orgId);
    if (clinicPool) clinicSeeds = await loadClinicSeeds(clinicPool, args.orgId);

    for (const organizationId of orgIds) {
      counters.orgsSeen += 1;
      let state = await loadExisting(orch, organizationId);

      // Pass 1 — Finance (preferred)
      const financePack = await loadFinanceSeed(financePool, organizationId);
      if (financePack) {
        state = await applyPlan(
          orch,
          organizationId,
          state,
          financePack.seed,
          counters,
          dryRun,
          "finance",
          financePack.logoMeta,
        );
      } else {
        console.info(`[no_finance_row] ${organizationId}`);
      }

      // Pass 2 — hotel/clinic only fill remaining empties (never overwrite Finance)
      if (hotelSeeds.has(organizationId)) {
        state = await applyPlan(
          orch,
          organizationId,
          state,
          hotelSeeds.get(organizationId)!,
          counters,
          dryRun,
          "hotel",
        );
      }

      if (clinicSeeds.has(organizationId)) {
        const clinicSeed = clinicSeeds.get(organizationId)!;
        const clinicLogo = resolveLogoUrlForCp(clinicSeed.logoUrl);
        state = await applyPlan(
          orch,
          organizationId,
          state,
          { ...clinicSeed, logoUrl: clinicLogo.url ?? null },
          counters,
          dryRun,
          "clinic",
          {
            skipDataUrl: clinicLogo.skipDataUrl,
            skipRelative: clinicLogo.skipRelative,
          },
        );
      }
    }

    console.info("[org-profile-backfill] summary", counters);
    if (dryRun) {
      console.info(
        "[org-profile-backfill] dry-run only — re-run with --apply to write",
      );
    }
  } finally {
    orch.release();
    await orchPool.end();
    await financePool.end();
    if (hotelPool) await hotelPool.end();
    if (clinicPool) await clinicPool.end();
  }
}

main().catch((err) => {
  console.error("[org-profile-backfill] FAILED", err);
  process.exit(1);
});
