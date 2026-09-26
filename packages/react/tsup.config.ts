import { copyFileSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["react", "react-dom"],
    // Required for <FormRenderer> to work when imported into a Next.js
    // Server Component file. This tags the WHOLE bundle as client-only,
    // which is why server-validation.ts is built separately below.
    banner: { js: '"use client";' },
    onSuccess: async () => {
      copyFileSync("src/styles.css", "dist/styles.css");
    },
  },
  {
    entry: { server: "src/server-validation.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: false,
  },
]);
