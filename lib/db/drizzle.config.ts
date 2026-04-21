import { defineConfig } from "drizzle-kit";
import { getAdminDatabaseUrl } from "./src/connection";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: getAdminDatabaseUrl(),
  },
});
