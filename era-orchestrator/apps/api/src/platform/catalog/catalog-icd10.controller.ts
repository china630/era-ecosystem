import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { createRequire } from "node:module";
import { Public } from "../../auth/decorators/public.decorator";
import { SatelliteCatalogGuard } from "./satellite-catalog.guard";

type Icd10Row = {
  code: string;
  kind: string;
  chapterCode: string;
  blockCode: string;
  parentCode: string | null;
  titleAz: string | null;
  titleRu: string | null;
  titleEn: string;
  searchText: string;
  selectable: boolean;
  active: boolean;
};

const requireCjs = createRequire(__filename);
const { loadIcd10Catalog, catalogStats } = requireCjs("@era/satellite-kit/icd10/catalog") as {
  loadIcd10Catalog: () => { version: string; rows: Icd10Row[] };
  catalogStats: (rows: Icd10Row[]) => Record<string, unknown>;
};

let cached: { version: string; rows: Icd10Row[]; stats: Record<string, unknown> } | null = null;

function catalog() {
  if (!cached) {
    const { version, rows } = loadIcd10Catalog();
    cached = { version, rows, stats: catalogStats(rows) };
  }
  return cached;
}

@ApiTags("platform-catalog")
@Public()
@UseGuards(SatelliteCatalogGuard)
@Controller("platform/v1/catalog/icd10")
export class CatalogIcd10Controller {
  @Get()
  @ApiOperation({
    summary: "WHO ICD-10 2019 catalog page with RU/AZ titles (served in-process; not data-hub)",
  })
  getCatalog(
    @Query("q") q?: string,
    @Query("chapter") chapter?: string,
    @Query("selectable") selectable?: string,
    @Query("take") takeRaw?: string,
    @Query("cursor") cursor?: string,
  ) {
    const { version, rows, stats } = catalog();
    const take = Math.min(Math.max(Number(takeRaw) || 100, 1), 50_000);
    const qNorm = q?.trim().toLowerCase() ?? "";
    const chapterNorm = chapter?.trim() || undefined;
    const selectableOnly = selectable !== "0" && selectable !== "false";

    let filtered = rows;
    if (selectableOnly) {
      filtered = filtered.filter((r) => r.selectable && r.active);
    }
    if (chapterNorm) {
      filtered = filtered.filter((r) => r.chapterCode === chapterNorm);
    }
    if (qNorm) {
      filtered = filtered.filter(
        (r) =>
          r.code.toLowerCase().startsWith(qNorm) ||
          r.searchText.includes(qNorm),
      );
    }

    let start = 0;
    if (cursor) {
      const idx = filtered.findIndex((r) => r.code === cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const slice = filtered.slice(start, start + take);
    const next = slice.length === take ? slice[slice.length - 1]?.code ?? null : null;

    return {
      version,
      total: filtered.length,
      stats,
      items: slice,
      nextCursor: next,
    };
  }

  @Get("version")
  @ApiOperation({ summary: "ICD-10 catalog version metadata" })
  getVersion() {
    const { version, stats, rows } = catalog();
    return { version, count: rows.length, stats };
  }
}
