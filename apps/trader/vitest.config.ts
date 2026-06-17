import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure-math parity suites need no DOM.
    environment: "node",
  },
  resolve: {
    // Mirror tsconfig.json `paths`: "@/*" -> apps/trader root.
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
