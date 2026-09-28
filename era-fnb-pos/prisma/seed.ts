/**
 * F&B POS default seed — no-op.
 * Role/outlet/menu rows are org-scoped; lab demo is npm run db:seed:demo (requires bind).
 * Never invent demo-org / env UUID.
 */
async function main() {
  console.log(
    "era-fnb-pos: no boot seed (org-scoped). Lab café: npm run db:seed:demo (ERA ID 100000).",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
