/**
 * Clone recipe — desired services + compose YAML for host agent apply.
 * Orchestrator never SSHs; agent pulls this JSON and applies locally.
 */

export type PlacementPackagingCode = "PER_SATELLITE" | "SINGLE_STACK";

export type PlacementCloneService = {
  satelliteKey: string;
  serviceName: string;
  image: string;
  port: number;
  healthPath: string;
};

export type PlacementCloneRecipe = {
  formatVersion: 1;
  organizationId: string;
  batchId: string;
  packaging: PlacementPackagingCode;
  targetHost: string;
  fromTopology: string;
  toTopology: string;
  stackName: string;
  services: PlacementCloneService[];
  /** Lab dry-run vs write compose file + docker compose up. */
  applyModeHint: "lab" | "compose";
  /** Generated compose project YAML (agent writes to disk in compose mode). */
  composeYaml: string;
  notes: string[];
};

const IMAGE_BY_KEY: Record<
  string,
  { image: string; port: number; healthPath: string }
> = {
  industry_hotel_pms: {
    image: "era/hotel-pms:latest",
    port: 3201,
    healthPath: "/api/health",
  },
  industry_hotel: {
    image: "era/hotel-pms:latest",
    port: 3201,
    healthPath: "/api/health",
  },
  industry_clinic: {
    image: "era/clinic:latest",
    port: 3202,
    healthPath: "/api/health",
  },
  industry_fnb_pos: {
    image: "era/fnb-pos:latest",
    port: 3203,
    healthPath: "/api/health",
  },
  industry_retail: {
    image: "era/retail:latest",
    port: 3204,
    healthPath: "/api/health",
  },
  finance_core: {
    image: "era/finance-core:latest",
    port: 3100,
    healthPath: "/api/health",
  },
  industry_banking: {
    image: "era/bank:latest",
    port: 3300,
    healthPath: "/api/health",
  },
  industry_crm: {
    image: "era/crm:latest",
    port: 3210,
    healthPath: "/api/health",
  },
  industry_logistics: {
    image: "era/logistics:latest",
    port: 3211,
    healthPath: "/api/health",
  },
  industry_construction: {
    image: "era/construction:latest",
    port: 3212,
    healthPath: "/api/health",
  },
  industry_auto_service: {
    image: "era/auto-service:latest",
    port: 3213,
    healthPath: "/api/health",
  },
  industry_wholesale: {
    image: "era/wholesale:latest",
    port: 3214,
    healthPath: "/api/health",
  },
};

function serviceForKey(satelliteKey: string): PlacementCloneService {
  const known = IMAGE_BY_KEY[satelliteKey];
  const slug = satelliteKey.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return {
    satelliteKey,
    serviceName: slug,
    image: known?.image ?? `era/${slug}:latest`,
    port: known?.port ?? 3200,
    healthPath: known?.healthPath ?? "/api/health",
  };
}

/** Compose project for empty dedicated clone (no pool secrets). */
export function buildPlacementComposeYaml(input: {
  organizationId: string;
  stackName: string;
  toTopology: string;
  services: PlacementCloneService[];
  packaging: PlacementPackagingCode;
}): string {
  const lines: string[] = [
    `# ERA placement clone — ${input.stackName}`,
    `# packaging=${input.packaging} topology=${input.toTopology}`,
    `# Pool secrets are never copied; platform tokens re-issued on CONFIGURE.`,
    "services:",
  ];
  for (const svc of input.services) {
    lines.push(`  ${svc.serviceName}:`);
    lines.push(`    image: ${svc.image}`);
    lines.push(`    ports:`);
    lines.push(`      - "${svc.port}:${svc.port}"`);
    lines.push(`    environment:`);
    lines.push(`      ERA_SATELLITE_ORGANIZATION_ID: "${input.organizationId}"`);
    lines.push(`      DEPLOYMENT_TOPOLOGY: "${input.toTopology}"`);
    lines.push(`      NODE_ENV: production`);
    lines.push(`    healthcheck:`);
    lines.push(
      `      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:${svc.port}${svc.healthPath} || exit 1"]`,
    );
    lines.push(`      interval: 10s`);
    lines.push(`      timeout: 5s`);
    lines.push(`      retries: 12`);
    lines.push(`      start_period: 40s`);
  }
  lines.push("");
  return lines.join("\n");
}

export function buildPlacementCloneRecipe(input: {
  organizationId: string;
  batchId: string;
  satelliteKeys: string[];
  packaging: PlacementPackagingCode;
  targetHost: string;
  fromTopology: string;
  toTopology: string;
  applyModeHint?: "lab" | "compose";
}): PlacementCloneRecipe {
  const services = input.satelliteKeys.map(serviceForKey);
  const stackName =
    input.packaging === "SINGLE_STACK"
      ? `era-org-${input.organizationId.slice(0, 8)}`
      : `era-org-${input.organizationId.slice(0, 8)}-split`;
  const applyModeHint =
    input.applyModeHint ??
    (process.env.ERA_PLACEMENT_CLONE_MODE?.trim().toLowerCase() === "compose"
      ? "compose"
      : "lab");
  const composeYaml = buildPlacementComposeYaml({
    organizationId: input.organizationId,
    stackName,
    toTopology: input.toTopology,
    services,
    packaging: input.packaging,
  });

  return {
    formatVersion: 1,
    organizationId: input.organizationId,
    batchId: input.batchId,
    packaging: input.packaging,
    targetHost: input.targetHost,
    fromTopology: input.fromTopology,
    toTopology: input.toTopology,
    stackName,
    services,
    applyModeHint,
    composeYaml,
    notes: [
      "Empty clone first — data import only after FREEZE + EXPORT.",
      "Platform secrets are re-issued on CONFIGURE; pool secrets are never copied.",
      input.packaging === "SINGLE_STACK"
        ? "SINGLE_STACK: one compose project for all selected satellites."
        : "PER_SATELLITE: one compose service (or stack) per satellite key.",
      applyModeHint === "compose"
        ? "composeYaml ready for host agent docker compose up."
        : "applyModeHint=lab: agent dry-run unless ERA_PLACEMENT_CLONE_MODE=compose.",
    ],
  };
}
