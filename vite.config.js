import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "./",
  publicDir: "public",
  plugins: [react()],
  build: { copyPublicDir: false, outDir: "public/build", emptyOutDir: true },
  server: { proxy: { "/api.php": "http://127.0.0.1:8787" } },
});
