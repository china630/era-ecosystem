import { validatePostingRolesAgainstCharts } from "../lib/posting/posting-seed";

validatePostingRolesAgainstCharts()
  .then(() => {
    console.log("posting-roles: ok");
  })
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
