/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["**/__tests__/**/*.spec.ts"],
  moduleNameMapper: {
    "^@era/satellite-kit/time$":
      "<rootDir>/../../../packages/satellite-kit/src/time/baku.ts",
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
