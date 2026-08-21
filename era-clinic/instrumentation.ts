export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { prisma } = await import("@/lib/prisma");
  const { onSatelliteBoot } = await import(
    /* webpackIgnore: true */ "@era/satellite-kit/tenancy/boot"
  );
  try {
    const result = await onSatelliteBoot({ prisma });
    if (result.organizationId) {
      console.info(
        `[clinic] organization bind hydrated source=${result.source} org=${result.organizationId}`,
      );
    } else {
      console.warn("[clinic] organization bind not set at boot (Sync or env required in production)");
    }
  } catch (err) {
    console.error("[clinic] onSatelliteBoot failed", err);
  }
}
