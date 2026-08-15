const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
Promise.all([p.patientRef.count(), p.labOrder.count()])
  .then(([patients, labOrders]) => {
    console.log(JSON.stringify({ patients, labOrders }));
    return p.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
