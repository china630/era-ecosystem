const fs = require("fs");

const matrixPath =
  "D:/My Projects/era-ecosystem/era-clinic/src/components/sanatorium/ResourceDayMatrix.tsx";
let s = fs.readFileSync(matrixPath, "utf8");
const badAlias = `export type Slot = MatrixSlot;
export type ResourceRow = MatrixResourceRow;

export type MatrixResourceRow = {
  resourceId: string;
  code: string;
  name: string;
  slots: MatrixSlot[];
};`;
const goodAlias = `export type MatrixResourceRow = {
  resourceId: string;
  code: string;
  name: string;
  slots: MatrixSlot[];
};

export type Slot = MatrixSlot;
export type ResourceRow = MatrixResourceRow;`;
if (s.includes(badAlias)) {
  s = s.replace(badAlias, goodAlias);
  fs.writeFileSync(matrixPath, s, "utf8");
  console.log("aliases reordered");
} else if (s.includes("export type Slot = MatrixSlot;")) {
  console.log("aliases already ok or different shape");
} else {
  console.error("aliases block missing");
  process.exit(1);
}

const pr = "D:/My Projects/era-ecosystem/era-clinic/app/api/procedures/route.ts";
let r = fs.readFileSync(pr, "utf8");
const re =
  /const orders = await prisma\.procedureOrder\.findMany\(\{[\s\S]*?take: 500,\n    \}\);/;
if (!re.test(r)) {
  console.error("findMany not found");
  process.exit(1);
}
r = r.replace(
  re,
  `const orders = await prisma.procedureOrder.findMany({
      where,
      include: {
        patientRef: true,
        resource: { select: { id: true, code: true, name: true } },
        allocations: {
          where: { role: "STAFF" },
          select: { practitionerId: true, role: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 500,
    });`,
);
fs.writeFileSync(pr, r, "utf8");
console.log("procedures include fixed byte0=", fs.readFileSync(pr)[0]);