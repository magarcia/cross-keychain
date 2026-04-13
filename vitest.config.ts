import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 5000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
