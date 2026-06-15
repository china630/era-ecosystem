import type { ESLint } from "eslint";

const config: ESLint.Config[] = [
  {
    files: ["src/kernel/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/modules/**", "../modules/**", "../../modules/**"],
              message:
                "Kernel (L1) must not import from modules (L2). See era-bank-core/TZ.md §1.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
