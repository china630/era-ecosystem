/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.(spec|e2e-spec)\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/test", "<rootDir>/__tests__"],
  // jose ships ESM-only; kit barrel pulls it — map kit to a CJS stand-in for unit tests.
  moduleNameMapper: {
    "^@era/satellite-kit$": "<rootDir>/test/helpers/mock-era-satellite-kit.cjs",
  },
};
