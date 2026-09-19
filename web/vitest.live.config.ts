import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Live checks against Studio Next: real transactions, minutes each. Run by
// hand with `pnpm test:live`; never part of `pnpm test` or CI.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/live/**/*.live.ts"],
    testTimeout: 900_000,
  },
});
