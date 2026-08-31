import { z } from "zod";
import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";
import {
  getPatientHistoryPage,
  getPatientPlanPage,
  type HistoryLabFilter,
} from "@/domain/patient/patient-card.service";
import type { TimelineEventType } from "@/domain/patient/patient-timeline.service";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  section: z.enum(["history", "plan"]).default("history"),
  types: z.string().optional(),
  labFilter: z.enum(["results", "pending", "all"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  episode: z.string().optional(),
});

const TYPE_SET = new Set<TimelineEventType>([
  "appointment",
  "visit",
  "lab_order",
  "procedure",
  "episode",
]);

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await ctx.params;
    const exists = await prisma.patientRef.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return jsonError("Not found", 404);

    const url = new URL(req.url);
    const query = querySchema.parse({
      section: url.searchParams.get("section") ?? undefined,
      types: url.searchParams.get("types") ?? undefined,
      labFilter: url.searchParams.get("labFilter") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      episode: url.searchParams.get("episode") ?? undefined,
    });

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && Number.isNaN(from.getTime())) return jsonError("Invalid from", 400);
    if (to && Number.isNaN(to.getTime())) return jsonError("Invalid to", 400);

    if (query.section === "plan") {
      return jsonOk(
        await getPatientPlanPage(id, {
          offset: query.offset,
          limit: query.limit,
          from,
          to,
          episodeId: query.episode,
        }),
      );
    }

    const rawTokens = query.types
      ? query.types
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const isAll =
      rawTokens.length === 0 ||
      rawTokens.includes("all") ||
      rawTokens.every((t) => t === "all");

    let labCatalogKind: "panel" | "imaging" | undefined;
    const types: TimelineEventType[] = [];

    if (!isAll) {
      for (const token of rawTokens) {
        if (token === "lab_panel") {
          labCatalogKind = "panel";
          if (!types.includes("lab_order")) types.push("lab_order");
          continue;
        }
        if (token === "lab_imaging") {
          labCatalogKind = "imaging";
          if (!types.includes("lab_order")) types.push("lab_order");
          continue;
        }
        if (TYPE_SET.has(token as TimelineEventType)) {
          types.push(token as TimelineEventType);
        }
      }
    }

    return jsonOk(
      await getPatientHistoryPage(id, {
        types: isAll || types.length === 0 ? undefined : types,
        labCatalogKind,
        labFilter: (query.labFilter ?? "all") as HistoryLabFilter,
        from,
        to,
        offset: query.offset,
        limit: query.limit,
        episodeId: query.episode,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
