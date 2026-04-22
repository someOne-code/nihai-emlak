import type { MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export const backfillLegacyUserRolesMigrationName =
  "20260422_legacy_payload_users_backfill_role_admin";

export function getBackfillLegacyUserRolesSQL(): string {
  return `
    do $$
    begin
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'payload'
          and table_name = 'users'
          and column_name = 'role'
      ) then
        update "payload"."users"
        set "role" = 'admin'
        where "role" is null;
      end if;
    end
    $$;
  `;
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(getBackfillLegacyUserRolesSQL()));
}

export async function down(): Promise<void> {
  // Data backfill is intentionally irreversible without a pre-migration snapshot.
}

export const backfillLegacyUserRolesMigration = {
  name: backfillLegacyUserRolesMigrationName,
  up,
  down,
};
