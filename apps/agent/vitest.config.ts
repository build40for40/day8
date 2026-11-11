import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "markdown-as-text",
      load(id) {
        if (id.endsWith(".md")) return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
      },
    },
  ],
  test: { include: ["src/**/*.test.ts"] },
});
