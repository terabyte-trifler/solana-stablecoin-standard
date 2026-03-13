// frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    commonjsOptions: {
      include: [/node_modules/, /sdk/],
    },
  },
  optimizeDeps: {
    include: ["@stbr/sss-token"],
  },
  define: {
    "process.env": {},
    global: "globalThis",
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      buffer: "buffer",
    },
  },
});
