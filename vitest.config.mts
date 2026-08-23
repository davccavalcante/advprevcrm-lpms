import path from "node:path";
import { defineConfig } from "vitest/config";

/*
 * The suite resolves the same "@/" alias the application uses, so a test
 * exercises the very module the screens import, never a copy.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      /* The real guard throws outside a server context by design; the suite
       * stubs it so server modules can be exercised, while the application
       * build keeps the guard fully armed. */
      "server-only": path.resolve(
        import.meta.dirname,
        "src/lib/__tests__/server-only.stub.ts",
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
