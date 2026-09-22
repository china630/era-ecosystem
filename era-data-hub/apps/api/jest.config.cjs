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
          paths: {
            "@era/satellite-kit/time": [
              "<rootDir>/../../../packages/satellite-kit/dist/time/baku",
            ],
          },
          esModuleInterop: true,
        },
        diagnostics: false,
      },
    ],
  },
};
