/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.spec.ts"],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@era/clinic-domain$": "<rootDir>/../packages/clinic-domain/src/index.ts",
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
