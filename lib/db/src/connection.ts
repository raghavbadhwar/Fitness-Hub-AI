type DatabaseUrlKey = "DATABASE_URL" | "DATABASE_ADMIN_URL";

function readDatabaseUrl(key: DatabaseUrlKey): string | undefined {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getRuntimeDatabaseUrl(): string {
  const url = readDatabaseUrl("DATABASE_URL");
  if (!url) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  }
  return url;
}

export function getAdminDatabaseUrl(): string {
  return readDatabaseUrl("DATABASE_ADMIN_URL") ?? getRuntimeDatabaseUrl();
}
