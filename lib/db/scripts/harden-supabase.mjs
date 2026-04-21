import pg from "pg";

const { Client } = pg;

const roleName = process.env.DATABASE_APP_ROLE?.trim() || "fitness_hub_app";
const rolePassword = process.env.DATABASE_APP_PASSWORD?.trim();
const adminUrl = process.env.DATABASE_ADMIN_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!/^[a-z_][a-z0-9_]*$/.test(roleName)) {
  throw new Error(`DATABASE_APP_ROLE must be a simple postgres identifier, received: ${roleName}`);
}

if (!rolePassword) {
  throw new Error("DATABASE_APP_PASSWORD must be set before running the Supabase hardening script.");
}

if (!adminUrl) {
  throw new Error("DATABASE_ADMIN_URL or DATABASE_URL must be set before running the Supabase hardening script.");
}

const client = new Client({ connectionString: adminUrl });

const escapedRolePassword = rolePassword.replace(/'/g, "''");
const escapedRoleName = roleName.replace(/"/g, "\"\"");

const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${roleName}') THEN
    EXECUTE 'CREATE ROLE "${escapedRoleName}" LOGIN PASSWORD ''${escapedRolePassword}'' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT';
  END IF;
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT CONNECT ON DATABASE postgres TO "${escapedRoleName}";
GRANT USAGE ON SCHEMA public TO "${escapedRoleName}";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${escapedRoleName}";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${escapedRoleName}";

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${escapedRoleName}";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "${escapedRoleName}";

ALTER ROLE "${escapedRoleName}" SET statement_timeout = '15s';
ALTER ROLE "${escapedRoleName}" SET idle_in_transaction_session_timeout = '15s';

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

DO $$
DECLARE
  target_table record;
BEGIN
  FOR target_table IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', target_table.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'fitness_hub_app_full_access', target_table.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO "${escapedRoleName}" USING (true) WITH CHECK (true)',
      'fitness_hub_app_full_access',
      target_table.tablename
    );
  END LOOP;
END $$;
`;

try {
  await client.connect();
  await client.query(sql);
  console.log(`Supabase hardening applied successfully for runtime role "${roleName}".`);
} finally {
  await client.end();
}
