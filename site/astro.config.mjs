import { defineConfig } from "astro/config";

const base = process.env.SITE_BASE ?? "/status";

export default defineConfig({
  base,
  trailingSlash: "ignore",
  build: { format: "directory" },
  devToolbar: { enabled: false },
});
