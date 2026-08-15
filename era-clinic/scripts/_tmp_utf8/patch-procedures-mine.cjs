const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "../../app/api/procedures/route.ts");
let src = fs.readFileSync(file, "utf8");
if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);

const marker = `    const overdueOnly = url.searchParams.get("overdueOnly") === "1";
    const resourceId = url.searchParams.get("resourceId")?.trim();

    const { start, end, date } = bakuDayBounds(dateParam);`;

const insert = `    const overdueOnly = url.searchParams.get("overdueOnly") === "1";
    const resourceId = url.searchParams.get("resourceId")?.trim();
    const mine = url.searchParams.get("mine") === "1";

    const { start, end, date } = bakuDayBounds(dateParam);

    if (mine) {
      const practitioner = await prisma.practitioner.findFirst({
        where: { userId: session!.sub },
        select: { id: true },
      });
      if (!practitioner) {
        return jsonOk({ date, count: 0, orders: [], mineUnlinked: true });
      }
      // filter applied below after where is built — stash id
      (globalThis as unknown as { __minePractitionerId?: string }).__minePractitionerId =
        practitioner.id;
    }`;

// Better approach: rewrite the whole GET more cleanly via block replace
const oldBlock = `    const overdueOnly = url.searchParams.get("overdueOnly") === "1";
    const resourceId = url.searchParams.get("resourceId")?.trim();

    const { start, end, date } = bakuDayBounds(dateParam);

    let statuses: ProcedureOrderStatus[] = ACTIVE_STATUSES;`;

const newBlock = `    const overdueOnly = url.searchParams.get("overdueOnly") === "1";
    const resourceId = url.searchParams.get("resourceId")?.trim();
    const mine = url.searchParams.get("mine") === "1";

    const { start, end, date } = bakuDayBounds(dateParam);

    let minePractitionerId: string | null = null;
    if (mine) {
      const practitioner = await prisma.practitioner.findFirst({
        where: { userId: session!.sub },
        select: { id: true },
      });
      if (!practitioner) {
        return jsonOk({ date, count: 0, orders: [], mineUnlinked: true });
      }
      minePractitionerId = practitioner.id;
    }

    let statuses: ProcedureOrderStatus[] = ACTIVE_STATUSES;`;

if (!src.includes(oldBlock)) {
  console.error("procedures route: start block not found");
  process.exit(1);
}
src = src.replace(oldBlock, newBlock);

const oldWhereEnd = `    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (overdueOnly) {`;

const newWhereEnd = `    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (minePractitionerId) {
      where.allocations = {
        some: { role: "STAFF", practitionerId: minePractitionerId },
      };
    }

    if (overdueOnly) {`;

if (!src.includes(oldWhereEnd)) {
  console.error("procedures route: where block not found");
  process.exit(1);
}
src = src.replace(oldWhereEnd, newWhereEnd);

const oldInclude = `    const orders = await prisma.procedureOrder.findMany({
      where,
      include: {
        patientRef: true,
        resource: { select: { id: true, code: true, name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 500,
    });

    return jsonOk({ date, count: orders.length, orders });`;

const newInclude = `    const orders = await prisma.procedureOrder.findMany({
      where,
      include: {
        patientRef: true,
        resource: { select: { id: true, code: true, name: true } },
        ...(minePractitionerId
          ? {
              allocations: {
                where: { role: "STAFF" as const },
                select: { practitionerId: true, role: true },
              },
            }
          : {}),
      },
      orderBy: { scheduledAt: "asc" },
      take: 500,
    });

    return jsonOk({ date, count: orders.length, orders });`;

if (!src.includes(oldInclude)) {
  console.error("procedures route: include block not found");
  process.exit(1);
}
src = src.replace(oldInclude, newInclude);

fs.writeFileSync(file, src, "utf8");
console.log("patched procedures route byte0=", fs.readFileSync(file)[0]);