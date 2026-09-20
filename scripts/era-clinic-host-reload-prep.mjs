import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function pick(rootEnv, key) {
  const m = rootEnv.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

function upsert(text, key, val) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) return text.replace(re, `${key}=${val}`);
  return `${text.replace(/\s*$/, "")}\n${key}=${val}\n`;
}

const rootEnv = fs.readFileSync(path.join(root, ".env"), "utf8");
const auth = pick(rootEnv, "AUTH_JWT_SECRET");
const sso = pick(rootEnv, "ERA_SSO_SHARED_SECRET");
const cp = pick(rootEnv, "CONTROL_PLANE_SERVICE_TOKEN");
const sat = pick(rootEnv, "SATELLITE_EVENT_SERVICE_TOKEN");
const mdm =
  pick(rootEnv, "MDM_INTERNAL_SERVICE_TOKEN") ||
  pick(rootEnv, "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN") ||
  cp;
if (!auth || auth.length < 16) throw new Error("AUTH_JWT_SECRET missing");
if (!sso || sso.length < 16) throw new Error("ERA_SSO_SHARED_SECRET missing");
if (!cp) throw new Error("CONTROL_PLANE_SERVICE_TOKEN missing");

const clinicEnvPath = path.join(root, "era-clinic", ".env");
let env = fs.existsSync(clinicEnvPath)
  ? fs.readFileSync(clinicEnvPath, "utf8")
  : "";

const pairs = {
  AUTH_JWT_SECRET: auth,
  ERA_SSO_SHARED_SECRET: sso,
  AUTH_COOKIE_NAME: pick(rootEnv, "CLINIC_AUTH_COOKIE_NAME") || "era_clinic_session",
  CONTROL_PLANE_SERVICE_TOKEN: cp,
  SATELLITE_EVENT_SERVICE_TOKEN: sat || "dev-satellite-event-token",
  MDM_INTERNAL_SERVICE_TOKEN: mdm,
  CONTROL_PLANE_URL: "http://127.0.0.1:4000",
  ORCHESTRATOR_URL: "http://127.0.0.1:4000",
  ORCHESTRATOR_EVENT_URL: "http://127.0.0.1:4000",
};
for (const [k, v] of Object.entries(pairs)) env = upsert(env, k, v);
const pgUser = pick(rootEnv, "POSTGRES_USER") || "era";
const pgPw = pick(rootEnv, "POSTGRES_PASSWORD") || "era_dev_password";
const clinicDb = pick(rootEnv, "CLINIC_DB") || "era_clinic";
const databaseUrl = `postgresql://${pgUser}:${encodeURIComponent(pgPw)}@127.0.0.1:5432/${clinicDb}?schema=public`;
env = upsert(env, "DATABASE_URL", databaseUrl);
fs.writeFileSync(clinicEnvPath, env, "utf8");
console.log("clinic .env synced");

try {
  const raw = execFileSync(
    "docker",
    [
      "exec",
      "era-postgres",
      "psql",
      "-U",
      "era",
      "-d",
      "era_clinic",
      "-t",
      "-A",
      "-c",
      'SELECT "configJson" FROM _era_runtime_config WHERE id = 1;',
    ],
    { encoding: "utf8" },
  ).trim();
  if (raw) {
    const cfg = JSON.parse(raw);
    const before = cfg.orchestratorEventUrl;
    cfg.orchestratorEventUrl = "http://orchestrator:4000";
    if (
      typeof cfg.publicBaseUrl === "string" &&
      cfg.publicBaseUrl.includes("clinic")
    ) {
      cfg.publicBaseUrl = "http://127.0.0.1:3203";
    }
    const b64 = Buffer.from(JSON.stringify(cfg), "utf8").toString("base64");
    const sql = `UPDATE _era_runtime_config SET "configJson" = convert_from(decode('${b64}', 'base64'), 'UTF8'), "updatedAt" = NOW(), "updatedBy" = 'host-hot-reload' WHERE id = 1;`;
    const sqlPath = path.join(root, "tmp-fix-runtime.sql");
    fs.writeFileSync(sqlPath, sql, "utf8");
    execFileSync("docker", ["cp", sqlPath, "era-postgres:/tmp/fix-runtime.sql"], {
      stdio: "inherit",
    });
    execFileSync(
      "docker",
      [
        "exec",
        "era-postgres",
        "psql",
        "-U",
        "era",
        "-d",
        "era_clinic",
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        "/tmp/fix-runtime.sql",
      ],
      { stdio: "inherit" },
    );
    fs.unlinkSync(sqlPath);
    console.log(
      `runtime url ${before} -> ${cfg.orchestratorEventUrl} (compose DNS; host kit rewrites on read)`,
    );
  } else {
    console.log("no runtime config row");
  }
} catch (e) {
  console.log("runtime fix skip", e instanceof Error ? e.message : e);
}

const fileCache = path.join(root, "era-clinic", ".data", "runtime-config.json");
if (fs.existsSync(fileCache)) {
  const j = JSON.parse(fs.readFileSync(fileCache, "utf8"));
  j.orchestratorEventUrl = "http://127.0.0.1:4000";
  fs.writeFileSync(fileCache, `${JSON.stringify(j, null, 2)}\n`);
  console.log("fixed file cache", fileCache);
}
