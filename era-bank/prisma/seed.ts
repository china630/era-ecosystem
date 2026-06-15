import { hashPassword } from "@era/satellite-kit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_BRANCH_ID = "demo-branch-hq";
const DEMO_PASSWORD = "demo1234";

const roles = [
  {
    code: "TELLER",
    name: "Teller",
    limitsJson: { maxDebitMinor: 500000, dailyPostingLimitAzn: 5000, canApprove: false },
  },
  {
    code: "BRANCH_MANAGER",
    name: "Branch manager",
    limitsJson: {
      maxDebitMinor: 5000000,
      dailyPostingLimitAzn: 50000,
      canApprove: true,
    },
  },
  {
    code: "AML_OFFICER",
    name: "Compliance / AML",
    limitsJson: { canScreen: true, canFileFmn: true },
  },
  {
    code: "CARDS_OFFICER",
    name: "Cards officer",
    limitsJson: { canIssueCards: true },
  },
  {
    code: "TREASURY_OFFICER",
    name: "Treasury officer",
    limitsJson: { canTradeFx: true },
  },
] as const;

const users = [
  {
    username: "teller-a",
    fullName: "Aysel Mammadova (Teller)",
    roleCode: "TELLER",
  },
  {
    username: "manager-b",
    fullName: "Rashad Aliyev (Branch manager)",
    roleCode: "BRANCH_MANAGER",
  },
  {
    username: "compliance",
    fullName: "Leyla Hasanova (Compliance)",
    roleCode: "AML_OFFICER",
  },
  {
    username: "cards-officer",
    fullName: "Orxan Quliyev (Cards)",
    roleCode: "CARDS_OFFICER",
  },
  {
    username: "treasury",
    fullName: "Nigar Suleymanova (Treasury)",
    roleCode: "TREASURY_OFFICER",
  },
] as const;

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const role of roles) {
    await prisma.opsRole.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        limitsJson: role.limitsJson,
      },
      create: {
        code: role.code,
        name: role.name,
        limitsJson: role.limitsJson,
      },
    });
  }

  for (const user of users) {
    const role = await prisma.opsRole.findUniqueOrThrow({
      where: { code: user.roleCode },
    });
    await prisma.opsUser.upsert({
      where: { username: user.username },
      update: {
        fullName: user.fullName,
        passwordHash,
        branchId: DEMO_BRANCH_ID,
        opsRoleId: role.id,
        status: "ACTIVE",
      },
      create: {
        username: user.username,
        fullName: user.fullName,
        passwordHash,
        branchId: DEMO_BRANCH_ID,
        opsRoleId: role.id,
        status: "ACTIVE",
      },
    });
  }

  console.log("Seeded era-bank ops users (password: demo1234):");
  for (const user of users) {
    console.log(`  - ${user.username} (${user.roleCode})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
