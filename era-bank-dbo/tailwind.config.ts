import type { Config } from "tailwindcss";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const satelliteKitContent = require("@era/satellite-kit/tailwind-content");

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./src/**/*.{js,ts,jsx,tsx}", ...satelliteKitContent],
  theme: {
    extend: {
      colors: {
        dbo: {
          primary: "#0B5FFF",
          surface: "#F4F6F8",
          ink: "#1A2332",
          muted: "#6B7A90",
        },
      },
    },
  },
  plugins: [],
};

export default config;
