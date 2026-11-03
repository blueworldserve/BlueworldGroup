import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Plain Vite setup for TanStack Start. `npm run build` writes a Node server to .output/server/index.mjs
// (what `npm start` runs). To deploy somewhere else, set NITRO_PRESET (e.g. NITRO_PRESET=vercel).
export default defineConfig({
  server: {
    port: 8080, // change to whatever you want
    strictPort: true, // fail instead of silently picking another port
  },
  plugins: [
    tsConfigPaths(),
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    tanstackStart({ server: { entry: "server" } }),
    nitro({ preset: process.env["NITRO_PRESET"] ?? "node-server" }),
    viteReact(),
    tailwindcss(),
  ],
});