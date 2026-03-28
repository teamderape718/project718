import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root,
  build: {
    outDir: "dist",
    emptyDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/pipeline": "http://127.0.0.1:3000",
      "/scrape": "http://127.0.0.1:3000",
      "/health": "http://127.0.0.1:3000",
    },
  },
});
