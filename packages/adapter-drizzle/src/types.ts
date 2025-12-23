import type { MTPCContext, PaginatedResult, QueryOptions } from '@mtpc/core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Drizzle 数据库实例类型
 * 基于 PostgresJsDatabase 的泛型类型
 */
export type DrizzleDB = PostgresJsDatabase<Record<string, never>>;

/**
 * 表 Schema 类型
 * 用于表示表的动态结构
 */
export type TableSchema = Record<string, unknown>;

/**
 * 仓储接口
 * 定义数据访问的基本 CRUD 操作
 *
 * **方法**：
 * - `findById` - 根据 ID 查找单条记录
 * - `findMany` - 查询多条记录（支持分页）
 * - `create` - 创建新记录
 * - `update` - 更新记录
 * - `delete` - 删除记录
 * - `count` - 统计记录数量
 */
export interface Repository<T> {
  /** 根据 ID 查找单条记录 */
  findById(ctx: MTPCContext, id: string): Promise<T | null>;
  /** 查询多条记录（支持分页、排序、过滤） */
  findMany(ctx: MTPCContext, options?: QueryOptions): Promise<PaginatedResult<T>>;
  /** 创建新记录 */
  create(ctx: MTPCContext, data: Partial<T>): Promise<T>;
  /** 更新记录 */
  update(ctx: MTPCContext, id: string, data: Partial<T>): Promise<T | null>;
  /** 删除记录 */
  delete(ctx: MTPCContext, id: string): Promise<boolean>;
  /** 统计记录数量 */
  count(ctx: MTPCContext, options?: QueryOptions): Promise<number>;
}

/**
 * 数据库配置
 * 用于创建 PostgreSQL 连接
 *
 * **属性**：
 * - `connectionString` - 数据库连接字符串
 * - `maxConnections` - 最大连接数（默认 10）
 * - `idleTimeout` - 空闲超时时间，秒（默认 20）
 * - `ssl` - SSL 配置
 */
export interface DatabaseConfig {
  /** 数据库连接字符串 */
  connectionString: string;
  /** 最大连接数 */
  maxConnections?: number;
  /** 空闲超时时间（秒） */
  idleTimeout?: number;
  /** SSL 配置 */
  ssl?: boolean | object;
}

/**
 * Schema 生成选项
 * 用于控制从资源定义生成数据库表的行为
 *
 * **属性**：
 * - `tenantColumn` - 租户列名（默认 'tenant_id'）
 * - `timestamps` - 是否添加时间戳列
 * - `softDelete` - 是否启用软删除
 * - `auditFields` - 是否添加审计字段
 */
export interface SchemaGenerationOptions {
  /** 租户列名 */
  tenantColumn?: string;
  /** 是否添加时间戳列 */
  timestamps?: boolean;
  /** 是否启用软删除 */
  softDelete?: boolean;
  /** 是否添加审计字段 */
  auditFields?: boolean;
}

/**
 * 从 Zod Schema 提取的列定义
 * 用于代码生成和迁移
 */
export interface ColumnDefinition {
  /** 列名 */
  name: string;
  /** 数据类型 */
  type: string;
  /** 是否可为空 */
  nullable: boolean;
  /** 默认值 */
  defaultValue?: unknown;
  /** 是否为主键 */
  primaryKey?: boolean;
  /** 是否唯一 */
  unique?: boolean;
  /** 外键引用 */
  references?: {
    table: string;
    column: string;
  };
}

/**
 * 表定义
 * 完整的数据库表结构定义
 */
export interface TableDefinition {
  /** 表名 */
  name: string;
  /** 列定义列表 */
  columns: ColumnDefinition[];
  /** 索引定义 */
  indexes?: IndexDefinition[];
  /** 外键定义 */
  foreignKeys?: ForeignKeyDefinition[];
}

/**
 * 索引定义
 */
export interface IndexDefinition {
  /** 索引名 */
  name: string;
  /** 包含的列 */
  columns: string[];
  /** 是否唯一索引 */
  unique?: boolean;
}

/**
 * 外键定义
 */
export interface ForeignKeyDefinition {
  /** 外键名 */
  name: string;
  /** 外键列 */
  columns: string[];
  /** 引用的表和列 */
  references: {
    table: string;
    columns: string[];
  };
  /** 删除行为 */
  onDelete?: 'cascade' | 'set null' | 'restrict' | 'no action';
  /** 更新行为 */
  onUpdate?: 'cascade' | 'set null' | 'restrict' | 'no action';
}
