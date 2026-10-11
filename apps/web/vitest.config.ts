import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next.js preserves JSX for its compiler; component tests need it transformed here.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: { include: ["test/**/*.test.ts"], exclude: ["node_modules", ".next"] },
});
