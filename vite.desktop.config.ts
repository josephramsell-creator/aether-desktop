import path from "node:path";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDir = import.meta.dirname;

export default defineConfig({
  root: path.resolve(rootDir, "desktop/renderer"),
  plugins: [tailwindcss(), viteReact()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  base: "./",
  publicDir: false,
  build: {
    outDir: path.resolve(rootDir, "desktop/dist"),
    emptyOutDir: true,
  },
});
