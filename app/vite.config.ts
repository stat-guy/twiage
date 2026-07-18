import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  resolve: { alias: { "@": "/src" } },
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    target: "es2020",
    cssMinify: true,
    minify: true,
  },
});
