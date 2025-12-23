import type { AnyZodSchema, ResourceDefinition } from '@mtpc/core';
import { toSnakeCase } from '@mtpc/shared';
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import type { ColumnDefinition, SchemaGenerationOptions, TableDefinition } from '../types.js';

/**
 * Schema 生成器
 * 从 Zod Schema 和资源定义生成 Drizzle 表结构
 *
 * **功能**：
 * - 将 Zod 类型映射到 Drizzle 列类型
 * - 从资源定义生成完整的表结构
 * - 支持租户隔离、时间戳、软删除等特性
 */

/**
 * 将 Zod 类型映射到 Drizzle 列类型
 *
 * @param zodType - Zod 类型
 * @param columnName - 列名
 * @returns Drizzle 列定义
 *
 * **支持的映射**：
 * - `ZodString` → varchar/uuid/text
 * - `ZodNumber` → integer/doublePrecision
 * - `ZodBigInt` → bigint
 * - `ZodBoolean` → boolean
 * - `ZodDate` → timestamp
 * - `ZodArray/ZodObject/ZodRecord` → jsonb
 * - `ZodEnum/ZodNativeEnum` → text
 */
function zodTypeToDrizzle(zodType: z.ZodTypeAny, columnName: string): any {
  const typeName = zodType._def.typeName;

  switch (typeName) {
    case 'ZodString': {
      const checks = zodType._def.checks ?? [];
      const maxLength = checks.find((c: any) => c.kind === 'max')?.value;
      const isUuid = checks.some((c: any) => c.kind === 'uuid');

      if (isUuid) {
        return uuid(columnName);
      }
      if (maxLength && maxLength <= 255) {
        return varchar(columnName, { length: maxLength });
      }
      return text(columnName);
    }

    case 'ZodNumber': {
      const numChecks = zodType._def.checks ?? [];
      const isInt = numChecks.some((c: any) => c.kind === 'int');
      if (isInt) {
        return integer(columnName);
      }
      return doublePrecision(columnName);
    }

    case 'ZodBigInt':
      return bigint(columnName, { mode: 'bigint' });

    case 'ZodBoolean':
      return boolean(columnName);

    case 'ZodDate':
      return timestamp(columnName, { withTimezone: true });

    case 'ZodArray':
    case 'ZodObject':
    case 'ZodRecord':
      return jsonb(columnName);

    case 'ZodEnum':
      return text(columnName);

    case 'ZodNativeEnum':
      return text(columnName);

    case 'ZodOptional':
    case 'ZodNullable':
      return zodTypeToDrizzle(zodType._def.innerType, columnName);

    case 'ZodDefault':
      return zodTypeToDrizzle(zodType._def.innerType, columnName);

    default:
      return text(columnName);
  }
}

/**
 * 检查 Zod 类型是否为可选或可空
 *
 * @param zodType - Zod 类型
 * @returns 是否可选
 */
function isOptional(zodType: z.ZodTypeAny): boolean {
  const typeName = zodType._def.typeName;
  return typeName === 'ZodOptional' || typeName === 'ZodNullable';
}

/**
 * 从 Zod 类型获取默认值
 *
 * @param zodType - Zod 类型
 * @returns 默认值
 */
function getDefaultValue(zodType: z.ZodTypeAny): unknown {
  if (zodType._def.typeName === 'ZodDefault') {
    return zodType._def.defaultValue();
  }
  return undefined;
}

/**
 * 从 Zod Schema 提取列定义
 * 用于代码生成和迁移工具
 *
 * @param schema - Zod Schema
 * @returns 列定义数组
 *
 * @throws {Error} 如果 Schema 不是 ZodObject
 */
export function extractColumns(schema: AnyZodSchema): ColumnDefinition[] {
  const columns: ColumnDefinition[] = [];

  if (schema._def.typeName !== 'ZodObject') {
    throw new Error('Schema must be a ZodObject');
  }

  const shape = schema._def.shape();

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as z.ZodTypeAny;
    const columnName = toSnakeCase(key);

    columns.push({
      name: columnName,
      type: zodType._def.typeName,
      nullable: isOptional(zodType),
      defaultValue: getDefaultValue(zodType),
      primaryKey: key === 'id',
    });
  }

  return columns;
}

/**
 * 从资源定义生成 Drizzle 表
 *
 * @param resource - 资源定义
 * @param options - 生成选项
 * @returns Drizzle 表定义
 *
 * **选项**：
 * - `tenantColumn` - 租户列名（默认 'tenant_id'）
 * - `timestamps` - 添加时间戳（默认 true）
 * - `softDelete` - 添加软删除字段
 * - `auditFields` - 添加审计字段
 */
export function generateTable(resource: ResourceDefinition, options: SchemaGenerationOptions = {}) {
  const {
    tenantColumn = 'tenant_id',
    timestamps = true,
    softDelete = false,
    auditFields = false,
  } = options;

  const tableName = toSnakeCase(resource.name);
  const schema = resource.schema;

  if (schema._def.typeName !== 'ZodObject') {
    throw new Error('Resource schema must be a ZodObject');
  }

  const shape = schema._def.shape();
  const columns: Record<string, any> = {};

  // 添加 ID 列
  columns.id = uuid('id').primaryKey().defaultRandom();

  // 添加租户列
  columns.tenantId = uuid(tenantColumn).notNull();

  // 从 Schema 添加列
  for (const [key, value] of Object.entries(shape)) {
    if (key === 'id' || key === 'tenantId') continue;

    const zodType = value as z.ZodTypeAny;
    const columnName = toSnakeCase(key);
    let column = zodTypeToDrizzle(zodType, columnName);

    // 处理可空
    if (!isOptional(zodType)) {
      column = column.notNull();
    }

    // 处理默认值
    const defaultVal = getDefaultValue(zodType);
    if (defaultVal !== undefined) {
      column = column.default(defaultVal);
    }

    columns[key] = column;
  }

  // 添加时间戳
  if (timestamps) {
    columns.createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
    columns.updatedAt = timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();
  }

  // 添加审计字段
  if (auditFields) {
    columns.createdBy = uuid('created_by');
    columns.updatedBy = uuid('updated_by');
  }

  // 添加软删除
  if (softDelete) {
    columns.deletedAt = timestamp('deleted_at', { withTimezone: true });
    columns.deletedBy = uuid('deleted_by');
  }

  // 创建带索引的表
  return pgTable(tableName, columns, (table: any) => ({
    tenantIdx: index(`${tableName}_tenant_idx`).on(table.tenantId),
    ...(timestamps
      ? {
          createdAtIdx: index(`${tableName}_created_at_idx`).on(table.createdAt),
        }
      : {}),
  }));
}

/**
 * 从资源列表生成所有表
 *
 * @param resources - 资源定义数组
 * @param options - 生成选项
 * @returns 表名到表定义的映射
 */
export function generateAllTables(
  resources: ResourceDefinition[],
  options: SchemaGenerationOptions = {}
): Record<string, ReturnType<typeof pgTable>> {
  const tables: Record<string, ReturnType<typeof pgTable>> = {};

  for (const resource of resources) {
    tables[resource.name] = generateTable(resource, options);
  }

  return tables;
}

/**
 * 生成表定义（用于迁移）
 * 返回表的元数据，而非 Drizzle 表对象
 *
 * @param resource - 资源定义
 * @param options - 生成选项
 * @returns 表定义
 */
export function generateTableDefinition(
  resource: ResourceDefinition,
  options: SchemaGenerationOptions = {}
): TableDefinition {
  const columns = extractColumns(resource.schema);
  const tableName = toSnakeCase(resource.name);

  // 添加系统列
  const systemColumns: ColumnDefinition[] = [
    { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
    { name: options.tenantColumn ?? 'tenant_id', type: 'uuid', nullable: false },
  ];

  if (options.timestamps !== false) {
    systemColumns.push(
      { name: 'created_at', type: 'timestamp', nullable: false },
      { name: 'updated_at', type: 'timestamp', nullable: false }
    );
  }

  if (options.auditFields) {
    systemColumns.push(
      { name: 'created_by', type: 'uuid', nullable: true },
      { name: 'updated_by', type: 'uuid', nullable: true }
    );
  }

  if (options.softDelete) {
    systemColumns.push(
      { name: 'deleted_at', type: 'timestamp', nullable: true },
      { name: 'deleted_by', type: 'uuid', nullable: true }
    );
  }

  return {
    name: tableName,
    columns: [...systemColumns, ...columns],
    indexes: [{ name: `${tableName}_tenant_idx`, columns: [options.tenantColumn ?? 'tenant_id'] }],
  };
}
