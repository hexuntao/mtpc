import { sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

/**
 * Create updated_at trigger SQL
 */
export function createUpdatedAtTrigger(tableName: string): string {
  return `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    DROP TRIGGER IF EXISTS update_${tableName}_updated_at ON ${tableName};
    
    CREATE TRIGGER update_${tableName}_updated_at
      BEFORE UPDATE ON ${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `;
}

/**
 * Create tenant isolation policy SQL (RLS)
 */
export function createTenantRLSPolicy(
  tableName: string,
  tenantColumn: string = 'tenant_id'
): string {
  return `
    ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation_policy ON ${tableName};
    
    CREATE POLICY tenant_isolation_policy ON ${tableName}
      USING (${tenantColumn} = current_setting('app.current_tenant')::uuid);
  `;
}

/**
 * Set current tenant for RLS
 */
export function setCurrentTenant(tenantId: string) {
  return sql`SET app.current_tenant = ${tenantId}`;
}

/**
 * Generate index name
 */
export function generateIndexName(
  tableName: string,
  columns: string[],
  unique: boolean = false
): string {
  const prefix = unique ? 'uq' : 'idx';
  return `${prefix}_${tableName}_${columns.join('_')}`;
}

/**
 * Generate foreign key name
 */
export function generateForeignKeyName(
  tableName: string,
  columns: string[],
  refTable: string
): string {
  return `fk_${tableName}_${columns.join('_')}_${refTable}`;
}
