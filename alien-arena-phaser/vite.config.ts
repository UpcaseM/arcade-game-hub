import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "../alien-arena",
    emptyOutDir: true
  },
  test: {
    include: ["src/tests/**/*.test.ts"],
    environment: "node"
  }
});
