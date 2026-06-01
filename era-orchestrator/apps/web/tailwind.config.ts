import type { Config } from "tailwindcss";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const satelliteKitContent = require("@era/satellite-kit/tailwind-content");

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    ...satelliteKitContent,
  ],
  theme: { extend: {} },
  plugins: [],
};

export default config;
