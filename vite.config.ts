import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

// `vite build --mode preview` produces one self-contained index.html
// (hash routing, everything inlined) for sharing a clickable preview.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === "preview" ? [viteSingleFile()] : [])],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  build: { outDir: mode === "preview" ? "dist-preview" : "dist" },
  // Local dev: forward API calls to the Node server (npm run dev:server).
  server: { proxy: { "/api": "http://localhost:8787" } },
}));
