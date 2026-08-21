/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["**/__tests__/**/*.spec.ts"],
  moduleNameMapper: {
    "^@era/satellite-kit/tenancy$":
      "<rootDir>/../../../packages/satellite-kit/src/tenancy/satellite-tenant-extension.ts",
    "^@era/satellite-kit/tenancy/boot$":
      "<rootDir>/../../../packages/satellite-kit/src/tenancy/organization-bind-core.ts",
    "^@era/satellite-kit$":
      "<rootDir>/../../../packages/satellite-kit/src/index.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          esModuleInterop: true,
        },
        diagnostics: false,
      },
    ],
  },
};
