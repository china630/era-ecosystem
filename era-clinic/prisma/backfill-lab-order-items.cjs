/**
 * Idempotent backfill: LabOrder.testCode (comma-separated) + resultJson snapshot
 * -> normalized LabOrderItem / LabResult rows (Phase 2 of lab-orders DB normalization).
 *
 * Only processes LabOrder rows that have zero LabOrderItem children yet, so it is
 * safe to re-run (already-backfilled or freshly-created-via-items orders are skipped).
 * Result lines from resultJson are attached to the first/primary item of the order.
 *
 * Run: node prisma/backfill-lab-order-items.cjs
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const VALID_FLAGS = new Set(["NORMAL", "HIGH", "LOW", "CRITICAL"]);

async function loadServiceIndex() {
  const services = await prisma.diagnosticService.findMany({
    include: { analytes: true },
  });
  const byCode = new Map();
  for (const svc of services) {
    byCode.set(svc.code, svc);
    if (!byCode.has(svc.serviceCode)) byCode.set(svc.serviceCode, svc);
  }
  return byCode;
}

function parseResultLines(resultJson) {
  if (!resultJson) return [];
  try {
    const parsed = JSON.parse(resultJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeFlag(flag) {
  const upper = typeof flag === "string" ? flag.toUpperCase() : "NORMAL";
  return VALID_FLAGS.has(upper) ? upper : "NORMAL";
}

async function main() {
  const serviceIndex = await loadServiceIndex();

  const orders = await prisma.labOrder.findMany({
    where: { items: { none: {} } },
    select: { id: true, testCode: true, amountNet: true, resultJson: true },
  });

  let ordersProcessed = 0;
  let itemsCreated = 0;
  let resultsCreated = 0;
  let unresolvedCodes = 0;

  for (const order of orders) {
    const codes = (order.testCode || "").split(",").map((c) => c.trim()).filter(Boolean);
    if (codes.length === 0) continue;

    const createdItems = [];
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      const service = serviceIndex.get(code) ?? null;
      if (!service) unresolvedCodes += 1;
      const item = await prisma.labOrderItem.create({
        data: {
          labOrderId: order.id,
          diagnosticServiceId: service ? service.id : null,
          serviceCode: service ? service.serviceCode : code,
          amountNet: i === 0 ? order.amountNet : 0,
          sortOrder: i,
        },
      });
      createdItems.push({ item, service });
      itemsCreated += 1;
    }

    const primary = createdItems[0];
    const lines = parseResultLines(order.resultJson);
    if (primary && lines.length > 0) {
      const analyteLabels = new Map();
      if (primary.service) {
        for (const a of primary.service.analytes) analyteLabels.set(a.code, a.labelEn);
      }

      const seen = new Set();
      const resultRows = [];
      for (const line of lines) {
        if (!line || line.code == null || line.value == null) continue;
        const code = String(line.code);
        if (seen.has(code)) continue;
        seen.add(code);
        resultRows.push({
          labOrderItemId: primary.item.id,
          code,
          label: analyteLabels.get(code) ?? null,
          value: String(line.value),
          unit: line.unit != null ? String(line.unit) : null,
          refMin: line.refMin != null ? String(line.refMin) : null,
          refMax: line.refMax != null ? String(line.refMax) : null,
          flag: normalizeFlag(line.flag),
        });
      }

      if (resultRows.length > 0) {
        await prisma.labResult.createMany({ data: resultRows });
        resultsCreated += resultRows.length;
      }
    }

    ordersProcessed += 1;
  }

  console.log(
    "[backfill-lab-order-items] orders=" +
      ordersProcessed +
      " items=" +
      itemsCreated +
      " results=" +
      resultsCreated +
      " unresolvedCodes=" +
      unresolvedCodes,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
