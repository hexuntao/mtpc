import { sql } from 'drizzle-orm';

/**
 * Schema 工具函数
 * 提供生成 SQL 触发器、RLS 策略、索引和外键的辅助函数
 */

/**
 * 创建 updated_at 触发器 SQL
 * 在记录更新时自动更新 updated_at 字段
 *
 * @param tableName - 表名
 * @returns SQL 语句
 *
 * **生成的 SQL**：
 * - 创建触发器函数 `update_updated_at_column`
 * - 在表更新前自动设置 `updated_at = CURRENT_TIMESTAMP`
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
 * 创建租户隔离策略 SQL（RLS）
 * 使用 PostgreSQL 行级安全策略实现租户数据隔离
 *
 * @param tableName - 表名
 * @param tenantColumn - 租户列名（默认 'tenant_id'）
 * @returns SQL 语句
 *
 * **功能**：
 * - 启用行级安全（RLS）
 * - 创建租户隔离策略
 * - 根据当前租户设置过滤数据
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
 * 设置当前租户（用于 RLS）
 * 设置会话级别的租户 ID，供 RLS 策略使用
 *
 * @param tenantId - 租户 ID
 * @returns SQL 语句
 *
 * **使用**：
 * ```ts
 * await db.execute(setCurrentTenant(tenantId));
 * ```
 */
export function setCurrentTenant(tenantId: string) {
  return sql`SET app.current_tenant = ${tenantId}`;
}

/**
 * 生成索引名称
 * 遵循命名约定：普通索引 `idx_`，唯一索引 `uq_`
 *
 * @param tableName - 表名
 * @param columns - 列名数组
 * @param unique - 是否唯一索引
 * @returns 索引名称
 *
 * **命名规则**：
 * - 普通索引：`idx_{table}_{col1}_{col2}`
 * - 唯一索引：`uq_{table}_{col1}_{col2}`
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
 * 生成外键名称
 * 遵循命名约定：`fk_{table}_{columns}_{refTable}`
 *
 * @param tableName - 表名
 * @param columns - 列名数组
 * @param refTable - 引用的表名
 * @returns 外键名称
 *
 * **命名规则**：
 * - 格式：`fk_{table}_{col1}_{col2}_{ref_table}`
 */
export function generateForeignKeyName(
  tableName: string,
  columns: string[],
  refTable: string
): string {
  return `fk_${tableName}_${columns.join('_')}_${refTable}`;
}
