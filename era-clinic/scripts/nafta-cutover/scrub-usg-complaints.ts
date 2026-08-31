/**
 * Remove clinical complaints that match USG protocol heuristics (mis-imported from WO diagnostics).
 *
 *   npx tsx scripts/nafta-cutover/scrub-usg-complaints.ts
 *   npx tsx scripts/nafta-cutover/scrub-usg-complaints.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const USG_MARKERS = [
  /\busg\b/i,
  /\busm\b/i,
  /ultrason/i,
  /ekograf/i,
  /qarin\s*b[oö]şlu[gğ]/i,
  /ki[cç]ik\s*[cç]anaq/i,
  /müayin[əe]\s*anket/i,
  /muayine\s*anket/i,
  /protokol/i,
  /hepar\s*[\d,.]+\s*mm/i,
  /düzgün\s*formada/i,
  /norma\s*daxil/i,
  /parxenx/i,
  /parankim/i,
  / ölçüsü /i,
  /ölçüləri/i,
];

export function isUsgProtocolComplaint(text: string): boolean {
  const hay = text.trim();
  if (!hay) return false;
  let hits = 0;
  for (const re of USG_MARKERS) {
    if (re.test(hay)) hits++;
  }
  if (hits >= 2) return true;
  if (/\busg\b/i.test(hay) && hay.length > 80) return true;
  if (/protokol/i.test(hay) && /mm/i.test(hay)) return true;
  return false;
}

async function main() {
  const rows = await prisma.clinicalComplaint.findMany({
    select: { id: true, text: true, episodeId: true, recordedAt: true },
    orderBy: { recordedAt: "asc" },
  });

  const matches = rows.filter((r) => isUsgProtocolComplaint(r.text));
  console.log(`${APPLY ? "APPLY" : "DRY-RUN"}: ${matches.length} USG-like complaints / ${rows.length} total`);

  for (const row of matches) {
    console.log(`  ${row.id} ep=${row.episodeId} ${row.text.slice(0, 72).replace(/\s+/g, " ")}…`);
    if (APPLY) {
      await prisma.clinicalComplaint.delete({ where: { id: row.id } });
    }
  }

  if (!APPLY && matches.length > 0) {
    console.log("Re-run with --apply to delete.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
