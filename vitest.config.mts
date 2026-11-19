import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// 전국 점검(약 40초)은 `npm run test:audit`(--mode audit)에서만 돈다
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: mode === "audit" ? configDefaults.exclude : [...configDefaults.exclude, "tests/national-audit.test.ts"],
    environment: "node",
  },
}));
