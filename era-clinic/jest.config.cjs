/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.spec.ts"],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  moduleNameMapper: {
    "^@/lib/production-calendar$": "<rootDir>/__tests__/mocks/production-calendar.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@era/clinic-domain$": "<rootDir>/../packages/clinic-domain/src/index.ts",
    "^@era/satellite-kit/integration/person-identity.client$":
      "<rootDir>/../packages/satellite-kit/src/integration/person-identity.client.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          esModuleInterop: true,
          jsx: "react-jsx",
        },
      },
    ],
  },
};
