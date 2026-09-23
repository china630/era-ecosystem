/**
 * Bank DBO default seed — no-op (demo Open API key must not rotate on every up).
 * Lab key: npm run db:seed:demo
 */
async function main() {
  console.log(
    "era-bank-dbo: no boot seed. For lab Open API key run: npm run db:seed:demo",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
