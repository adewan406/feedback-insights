import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api requests will go to the Cloudflare Worker once we add it in Step 3.
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy: { "/api": "http://127.0.0.1:8787" } },
});
