/**
 * One-shot scaffold for CRM integrations waves (UTF-8).
 * Run: node scripts/scaffold-crm-integrations-wave.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
// Windows file URL quirk
const rootWin = process.cwd().includes("era-ecosystem")
  ? process.cwd()
  : "D:/My Projects/era-ecosystem";

function w(rel, content) {
  const p = path.join(rootWin, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r\n/g, "\n"), "utf8");
  console.log("wrote", rel);
}

w(
  "packages/integrations-kit/package.json",
  JSON.stringify(
    {
      name: "@era/integrations-kit",
      version: "0.0.1",
      private: true,
      description:
        "ERA external vendor adapters, manifests, and fail-closed crypto for CRM integrations",
      main: "dist/index.js",
      types: "dist/index.d.ts",
      exports: {
        ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
      },
      scripts: {
        build: "tsc -p tsconfig.json",
        test: "jest --ci",
      },
      devDependencies: {
        typescript: "^5.7.3",
        "@types/node": "^22.15.21",
        jest: "^29.7.0",
        "@types/jest": "^29.5.14",
        "ts-jest": "^29.2.5",
      },
    },
    null,
    2,
  ) + "\n",
);

w(
  "packages/integrations-kit/tsconfig.json",
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "CommonJS",
        declaration: true,
        outDir: "dist",
        rootDir: "src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: ["src/**/*"],
    },
    null,
    2,
  ) + "\n",
);

w(
  "packages/integrations-kit/jest.config.cjs",
  `/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.spec.ts"],
};
`,
);

console.log("base package meta ok", rootWin);
