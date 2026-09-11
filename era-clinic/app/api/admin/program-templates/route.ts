import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";
import {
  bakuDateOnly,
  closeProgramTemplateValidity,
  parseDateOnly,
  programTemplateCreateSchema,
  programTemplateInclude,
  replaceTemplateProceduresAndKnots,
  shapeProgramTemplate,
  countOpenInstancesForTemplate,
  countAnyInstancesForTemplate,
  purgeRetiredTemplatesWithoutInstances,
  backfillEntitlementSnapshots,
} from "@/domain/sanatorium/program-template-admin";

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const includeRetired = url.searchParams.get("includeRetired") === "1";
    const rows = await prisma.programTemplate.findMany({
      where: includeRetired ? undefined : { isCurrent: true },
      orderBy: [{ code: "asc" }, { version: "desc" }],
      include: programTemplateInclude,
    });
    const shaped = [];
    for (const row of rows) {
      const [openInstanceCount, pinInstanceCount] = await Promise.all([
        countOpenInstancesForTemplate(row.id),
        countAnyInstancesForTemplate(row.id),
      ]);
      shaped.push(
        shapeProgramTemplate({
          ...row,
          openInstanceCount,
          pinInstanceCount,
        }),
      );
    }
    return jsonOk(shaped);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "purge-retired") {
      const body = (await req.json().catch(() => ({}))) as {
        olderThanDays?: number;
      };
      const result = await purgeRetiredTemplatesWithoutInstances({
        olderThanDays:
          typeof body.olderThanDays === "number" ? body.olderThanDays : 0,
      });
      return jsonOk(result);
    }
    if (action === "backfill-snapshots") {
      const result = await backfillEntitlementSnapshots();
      return jsonOk(result);
    }

    const body = programTemplateCreateSchema.parse(await req.json());
    const existingCurrent = await prisma.programTemplate.findFirst({
      where: { code: body.code, isCurrent: true },
    });
    if (existingCurrent) {
      return jsonOk(
        { error: "CODE_EXISTS", message: "A current package with this code already exists" },
        409,
      );
    }
    const effectiveFrom =
      parseDateOnly(body.effectiveFrom ?? null) ?? parseDateOnly(bakuDateOnly());
    const effectiveTo = parseDateOnly(body.effectiveTo ?? null);
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      return jsonOk(
        { error: "INVALID_VALIDITY_RANGE", message: "Valid-to must not precede valid-from" },
        400,
      );
    }
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.programTemplate.create({
        data: {
          code: body.code,
          name: body.name,
          durationDays: body.durationDays,
          version: 1,
          isCurrent: true,
          effectiveFrom,
          effectiveTo,
          ...(body.minNights !== undefined ? { minNights: body.minNights } : {}),
          ...(body.maxNights !== undefined ? { maxNights: body.maxNights } : {}),
        },
      });
      await replaceTemplateProceduresAndKnots(
        tx,
        created.id,
        body.procedures,
        body.knots,
      );
      return tx.programTemplate.findUniqueOrThrow({
        where: { id: created.id },
        include: programTemplateInclude,
      });
    });
    return jsonOk(shapeProgramTemplate({ ...row, openInstanceCount: 0, pinInstanceCount: 0 }), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonOk({ error: "id required" }, 400);
    const pinned = await prisma.programInstance.count({ where: { templateId: id } });
    if (pinned > 0) {
      // Guests pinned this version — close the sales window instead of erasing their entitlement.
      const { effectiveTo } = await closeProgramTemplateValidity(id);
      return jsonOk({ deleted: false, closed: true, effectiveTo, pinnedInstances: pinned });
    }
    await prisma.programTemplate.delete({ where: { id } });
    return jsonOk({ deleted: true, closed: false });
  } catch (err) {
    return handleRouteError(err);
  }
}
