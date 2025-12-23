import type { AnyZodSchema, ResourceDefinition } from '@mtpc/core';
import { toSnakeCase } from '@mtpc/shared';
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import type { ColumnDefinition, SchemaGenerationOptions, TableDefinition } from '../types.js';

/**
 * Map Zod type to Drizzle column type
 */
function zodTypeToDrizzle(zodType: z.ZodTypeAny, columnName: string): any {
  const typeName = zodType._def.typeName;

  switch (typeName) {
    case 'ZodString': {
      const checks = zodType._def.checks ?? [];
      const maxLength = checks.find((c: any) => c.kind === 'max')?.value;
      const isUuid = checks.some((c: any) => c.kind === 'uuid');
      const isEmail = checks.some((c: any) => c.kind === 'email');
      const isUrl = checks.some((c: any) => c.kind === 'url');

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
 * Check if Zod type is optional/nullable
 */
function isOptional(zodType: z.ZodTypeAny): boolean {
  const typeName = zodType._def.typeName;
  return typeName === 'ZodOptional' || typeName === 'ZodNullable';
}

/**
 * Get default value from Zod type
 */
function getDefaultValue(zodType: z.ZodTypeAny): unknown {
  if (zodType._def.typeName === 'ZodDefault') {
    return zodType._def.defaultValue();
  }
  return undefined;
}

/**
 * Extract column definitions from Zod schema
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
 * Generate Drizzle table from resource definition
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

  // Add ID column
  columns.id = uuid('id').primaryKey().defaultRandom();

  // Add tenant column
  columns.tenantId = uuid(tenantColumn).notNull();

  // Add columns from schema
  for (const [key, value] of Object.entries(shape)) {
    if (key === 'id' || key === 'tenantId') continue;

    const zodType = value as z.ZodTypeAny;
    const columnName = toSnakeCase(key);
    let column = zodTypeToDrizzle(zodType, columnName);

    // Handle nullable
    if (!isOptional(zodType)) {
      column = column.notNull();
    }

    // Handle default value
    const defaultVal = getDefaultValue(zodType);
    if (defaultVal !== undefined) {
      column = column.default(defaultVal);
    }

    columns[key] = column;
  }

  // Add timestamps
  if (timestamps) {
    columns.createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
    columns.updatedAt = timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();
  }

  // Add audit fields
  if (auditFields) {
    columns.createdBy = uuid('created_by');
    columns.updatedBy = uuid('updated_by');
  }

  // Add soft delete
  if (softDelete) {
    columns.deletedAt = timestamp('deleted_at', { withTimezone: true });
    columns.deletedBy = uuid('deleted_by');
  }

  // Create table with indexes
  return pgTable(tableName, columns, table => ({
    tenantIdx: index(`${tableName}_tenant_idx`).on(table.tenantId),
    ...(timestamps
      ? {
          createdAtIdx: index(`${tableName}_created_at_idx`).on(table.createdAt),
        }
      : {}),
  }));
}

/**
 * Generate all tables from MTPC registry
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
 * Generate table definition (for migrations)
 */
export function generateTableDefinition(
  resource: ResourceDefinition,
  options: SchemaGenerationOptions = {}
): TableDefinition {
  const columns = extractColumns(resource.schema);
  const tableName = toSnakeCase(resource.name);

  // Add system columns
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
