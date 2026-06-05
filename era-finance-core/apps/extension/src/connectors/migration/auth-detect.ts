import { migrationSelectors } from "./selectors";

export type MigrationAuthState = "unknown" | "logged_in" | "logged_out";

export function detectMigrationAuthState(doc: Document): MigrationAuthState {
  const login = doc.querySelector('input[type="password"], a[href*="login"]');
  const portal = doc.querySelector(migrationSelectors.registrationForm);
  if (portal) return "logged_in";
  if (login) return "logged_out";
  return "unknown";
}
