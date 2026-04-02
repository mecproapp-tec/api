import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  
  base: "/", // 

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  optimizeDeps: {
    include: ["@tanstack/react-query"],
  },

  build: {
    outDir: "dist",
  },

  preview: {
    host: true,
    port: 8080,
  },
});