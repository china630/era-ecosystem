export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { prisma } = await import("@/lib/prisma");
  const { onSatelliteBoot } = await import(
    /* webpackIgnore: true */ "@era/satellite-kit/tenancy/boot"
  );
  const { satelliteRuntimeConfig } = await import(
    /* webpackIgnore: true */ "@era/satellite-kit"
  );
  try {
    const result = await onSatelliteBoot({ prisma });
    if (satelliteRuntimeConfig().deploymentTopology === "SHARED") {
      console.info("[bank] SHARED pool: process organization bind cleared");
    } else if (result.organizationId) {
      console.info(
        `[bank] organization bind hydrated source=${result.source} org=${result.organizationId}`,
      );
    } else {
      console.warn(
        "[bank] organization bind not set at boot (Sync or env required in production)",
      );
    }
  } catch (err) {
    console.error("[bank] onSatelliteBoot failed", err);
  }
}
