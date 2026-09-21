/** @type {import("jest").Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        // Avoid whole-program typecheck failures in unrelated modules blocking unit specs.
        isolatedModules: true,
      },
    ],
  },
  testEnvironment: "node",
  moduleNameMapper: {
    "^@era/satellite-kit/integration/person-name$":
      "<rootDir>/../../../../packages/satellite-kit/src/integration/person-name.ts",
  },
};
