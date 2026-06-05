/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["**/__tests__/**/*.spec.ts"],
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
