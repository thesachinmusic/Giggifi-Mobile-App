import { defineConfig } from "vitest/config";

// Pure-logic tests only (push registration steps, primer cap). Native modules
// are mocked in each test; nothing here renders React Native.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
