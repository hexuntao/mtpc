import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '../types.js';

/**
 * Migration record
 */
interface MigrationRecord {
  id: string;
  name: string;
  executedAt: Date;
}

/**
 * Migration function type
 */
type MigrationFn = (db: DrizzleDB) => Promise<void>;

/**
 * Migration definition
 */
interface Migration {
  id: string;
  name: string;
  up: MigrationFn;
  down?: MigrationFn;
}

/**
 * Migration runner
 */
export class MigrationRunner {
  private db: DrizzleDB;
  private migrations: Migration[] = [];
  private tableName: string;

  constructor(db: DrizzleDB, options: { tableName?: string } = {}) {
    this.db = db;
    this.tableName = options.tableName ?? 'mtpc_migrations';
  }

  /**
   * Register migration
   */
  register(migration: Migration): this {
    this.migrations.push(migration);
    return this;
  }

  /**
   * Register multiple migrations
   */
  registerMany(migrations: Migration[]): this {
    this.migrations.push(...migrations);
    return this;
  }

  /**
   * Initialize migrations table
   */
  async init(): Promise<void> {
    await this.db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    );
  }

  /**
   * Get executed migrations
   */
  async getExecuted(): Promise<MigrationRecord[]> {
    const result = await this.db.execute(
      sql.raw(`SELECT * FROM ${this.tableName} ORDER BY executed_at`)
    );
    return result as MigrationRecord[];
  }

  /**
   * Get pending migrations
   */
  async getPending(): Promise<Migration[]> {
    const executed = await this.getExecuted();
    const executedIds = new Set(executed.map(m => m.id));
    return this.migrations.filter(m => !executedIds.has(m.id));
  }

  /**
   * Run pending migrations
   */
  async migrate(): Promise<string[]> {
    await this.init();

    const pending = await this.getPending();
    const executed: string[] = [];

    for (const migration of pending) {
      console.log(`Running migration: ${migration.name}`);

      await this.db.transaction(async tx => {
        await migration.up(tx as DrizzleDB);

        await tx.execute(
          sql.raw(`
          INSERT INTO ${this.tableName} (id, name)
          VALUES ('${migration.id}', '${migration.name}')
        `)
        );
      });

      executed.push(migration.id);
      console.log(`Completed: ${migration.name}`);
    }

    return executed;
  }

  /**
   * Rollback last migration
   */
  async rollback(): Promise<string | null> {
    await this.init();

    const executed = await this.getExecuted();
    if (executed.length === 0) {
      return null;
    }

    const last = executed[executed.length - 1];
    const migration = this.migrations.find(m => m.id === last.id);

    if (!migration?.down) {
      throw new Error(`Migration ${last.name} does not support rollback`);
    }

    console.log(`Rolling back: ${migration.name}`);

    await this.db.transaction(async tx => {
      await migration.down!(tx as DrizzleDB);

      await tx.execute(
        sql.raw(`
        DELETE FROM ${this.tableName}
        WHERE id = '${migration.id}'
      `)
      );
    });

    console.log(`Rolled back: ${migration.name}`);
    return migration.id;
  }

  /**
   * Reset all migrations
   */
  async reset(): Promise<void> {
    const executed = await this.getExecuted();

    // Rollback in reverse order
    for (let i = executed.length - 1; i >= 0; i--) {
      await this.rollback();
    }
  }
}

/**
 * Create migration runner
 */
export function createMigrationRunner(
  db: DrizzleDB,
  options?: { tableName?: string }
): MigrationRunner {
  return new MigrationRunner(db, options);
}

/**
 * Create MTPC system tables migration
 */
export function createSystemTablesMigration(): Migration {
  return {
    id: '0001_mtpc_system_tables',
    name: 'Create MTPC system tables',
    async up(db) {
      await db.execute(
        sql.raw(`
        CREATE TABLE IF NOT EXISTS tenants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) UNIQUE,
          status VARCHAR(50) DEFAULT 'active' NOT NULL,
          config JSONB,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );

        CREATE INDEX IF NOT EXISTS tenants_slug_idx ON tenants(slug);
        CREATE INDEX IF NOT EXISTS tenants_status_idx ON tenants(status);

        CREATE TABLE IF NOT EXISTS permission_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          subject_type VARCHAR(50) NOT NULL,
          subject_id UUID NOT NULL,
          permission VARCHAR(255) NOT NULL,
          granted BOOLEAN DEFAULT true NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by UUID
        );

        CREATE INDEX IF NOT EXISTS perm_assign_tenant_idx ON permission_assignments(tenant_id);
        CREATE INDEX IF NOT EXISTS perm_assign_subject_idx ON permission_assignments(tenant_id, subject_type, subject_id);
        CREATE INDEX IF NOT EXISTS perm_assign_permission_idx ON permission_assignments(tenant_id, permission);

        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          subject_id UUID,
          subject_type VARCHAR(50),
          action VARCHAR(100) NOT NULL,
          resource VARCHAR(100) NOT NULL,
          resource_id UUID,
          changes JSONB,
          metadata JSONB,
          ip VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );

        CREATE INDEX IF NOT EXISTS audit_tenant_idx ON audit_logs(tenant_id);
        CREATE INDEX IF NOT EXISTS audit_subject_idx ON audit_logs(tenant_id, subject_id);
        CREATE INDEX IF NOT EXISTS audit_resource_idx ON audit_logs(tenant_id, resource, resource_id);
        CREATE INDEX IF NOT EXISTS audit_created_at_idx ON audit_logs(created_at);
      `)
      );
    },
    async down(db) {
      await db.execute(
        sql.raw(`
        DROP TABLE IF EXISTS audit_logs;
        DROP TABLE IF EXISTS permission_assignments;
        DROP TABLE IF EXISTS tenants;
      `)
      );
    },
  };
}
