import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error("BASE_PATH environment variable is required but was not provided.");
}

const basePathWithoutTrailingSlash = basePath.replace(/\/$/, "") || "/";

function redirectBasePathWithoutTrailingSlashPlugin() {
  const attachRedirect = (middlewares: {
    use: (
      handler: (
        req: { url?: string },
        res: {
          statusCode?: number;
          setHeader: (name: string, value: string) => void;
          end: () => void;
        },
        next: () => void,
      ) => void,
    ) => void;
  }) => {
    middlewares.use((req, res, next) => {
      if (req.url === basePathWithoutTrailingSlash && req.url !== basePath) {
        res.statusCode = 302;
        res.setHeader("Location", basePath);
        res.end();
        return;
      }

      next();
    });
  };

  return {
    name: "redirect-base-path-without-trailing-slash",
    configureServer(server: {
      middlewares: { use: typeof attachRedirect extends (arg: infer T) => void ? T["use"] : never };
    }) {
      attachRedirect(server.middlewares);
    },
    configurePreviewServer(server: {
      middlewares: { use: typeof attachRedirect extends (arg: infer T) => void ? T["use"] : never };
    }) {
      attachRedirect(server.middlewares);
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), redirectBasePathWithoutTrailingSlashPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
