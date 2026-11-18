import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Read only API_PORT from the repo-root .env so the proxy follows the server. (The API key stays server-side.)
const rootEnv = new URL("../../.env", import.meta.url);
const apiPort = (existsSync(rootEnv) ? parseEnv(readFileSync(rootEnv, "utf8")).API_PORT : undefined) || 8787;

export default defineConfig({
  plugins: [react()],
  server: {
    // 5173 unless PORT says otherwise (the preview tool picks a free one when 5173 is taken).
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    // The API server owns all game state; in dev, Vite forwards /api to it.
    proxy: { "/api": `http://localhost:${apiPort}` },
  },
});
