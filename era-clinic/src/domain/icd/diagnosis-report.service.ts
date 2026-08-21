import { prisma } from "@/lib/prisma";
import { formatIcdLabel, normalizeIcdLocale } from "@/domain/icd/icd-catalog";

export async function listDiagnosisReport(input: {
  fromYmd: string;
  toYmd: string;
  source?: "episode" | "visit" | "admission" | "all";
  chapter?: string;
  locale?: string;
}) {
  const locale = normalizeIcdLocale(input.locale);
  const from = new Date(`${input.fromYmd}T00:00:00+04:00`);
  const to = new Date(`${input.toYmd}T23:59:59.999+04:00`);
  const chapter = input.chapter?.trim() || undefined;
  const source = input.source ?? "all";

  const icdFilter = chapter ? { chapterCode: chapter } : undefined;

  const [episodes, visits, admissions] = await Promise.all([
    source === "all" || source === "episode"
      ? prisma.clinicalDiagnosis.findMany({
          where: {
            recordedAt: { gte: from, lte: to },
            ...(icdFilter ? { icdCode: icdFilter } : {}),
          },
          include: { icdCode: true },
        })
      : Promise.resolve([]),
    source === "all" || source === "visit"
      ? prisma.visitDiagnosis.findMany({
          where: {
            recordedAt: { gte: from, lte: to },
            ...(icdFilter ? { icdCode: icdFilter } : {}),
          },
          include: {
            icdCode: true,
            visit: { include: { practitioner: { select: { fullName: true } } } },
          },
        })
      : Promise.resolve([]),
    source === "all" || source === "admission"
      ? prisma.admissionDiagnosis.findMany({
          where: {
            recordedAt: { gte: from, lte: to },
            ...(icdFilter ? { icdCode: icdFilter } : {}),
          },
          include: { icdCode: true },
        })
      : Promise.resolve([]),
  ]);

  type Agg = {
    code: string;
    chapterCode: string;
    title: string;
    episode: number;
    visit: number;
    admission: number;
    practitioners: Set<string>;
  };
  const map = new Map<string, Agg>();

  function bump(
    code: string,
    chapterCode: string,
    title: string,
    bucket: "episode" | "visit" | "admission",
    practitioner?: string | null,
  ) {
    const cur = map.get(code) ?? {
      code,
      chapterCode,
      title,
      episode: 0,
      visit: 0,
      admission: 0,
      practitioners: new Set<string>(),
    };
    cur[bucket] += 1;
    if (practitioner) cur.practitioners.add(practitioner);
    map.set(code, cur);
  }

  for (const d of episodes) {
    bump(
      d.icdCode.code,
      d.icdCode.chapterCode,
      formatIcdLabel(d.icdCode, locale),
      "episode",
    );
  }
  for (const d of visits) {
    bump(
      d.icdCode.code,
      d.icdCode.chapterCode,
      formatIcdLabel(d.icdCode, locale),
      "visit",
      d.visit.practitioner.fullName,
    );
  }
  for (const d of admissions) {
    bump(
      d.icdCode.code,
      d.icdCode.chapterCode,
      formatIcdLabel(d.icdCode, locale),
      "admission",
    );
  }

  const items = [...map.values()]
    .map((r) => ({
      code: r.code,
      chapterCode: r.chapterCode,
      title: r.title,
      episode: r.episode,
      visit: r.visit,
      admission: r.admission,
      total: r.episode + r.visit + r.admission,
      practitioners: [...r.practitioners].sort(),
    }))
    .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));

  return {
    from: input.fromYmd,
    to: input.toYmd,
    source,
    items,
  };
}
