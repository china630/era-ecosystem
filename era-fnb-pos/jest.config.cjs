/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.spec.ts"],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@era/satellite-kit/integration/hotel-revenue-route$":
      "<rootDir>/../packages/satellite-kit/src/integration/hotel-revenue-route.ts",
    "^@era/satellite-kit/integration/folio-charge-ref$":
      "<rootDir>/../packages/satellite-kit/src/integration/folio-charge-ref.ts",
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
