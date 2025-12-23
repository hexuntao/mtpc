import type { FilterCondition, MTPCContext, SortOptions } from '@mtpc/core';
import {
  and,
  asc,
  between,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  like,
  not,
  or,
  sql,
} from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDB } from '../types.js';

/**
 * Query builder for complex queries
 */
export class QueryBuilder<T extends Record<string, unknown>> {
  private db: DrizzleDB;
  private table: PgTable;
  private ctx: MTPCContext;
  private conditions: any[] = [];
  private sortOptions: any[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private selectColumns: string[] = [];
  private includeSoftDeleted = false;

  constructor(db: DrizzleDB, table: PgTable, ctx: MTPCContext) {
    this.db = db;
    this.table = table;
    this.ctx = ctx;

    // Always filter by tenant
    const tableAny = table as any;
    this.conditions.push(eq(tableAny.tenantId, ctx.tenant.id));
  }

  /**
   * Add where condition
   */
  where(field: string, operator: string, value: unknown): this {
    const tableAny = this.table as any;
    const column = tableAny[field];

    if (!column) {
      throw new Error(`Column not found: ${field}`);
    }

    const condition = this.buildCondition(column, operator, value);
    this.conditions.push(condition);

    return this;
  }

  /**
   * Add where equals condition
   */
  whereEquals(field: string, value: unknown): this {
    return this.where(field, 'eq', value);
  }

  /**
   * Add where in condition
   */
  whereIn(field: string, values: unknown[]): this {
    return this.where(field, 'in', values);
  }

  /**
   * Add where like condition
   */
  whereLike(field: string, pattern: string): this {
    return this.where(field, 'like', pattern);
  }

  /**
   * Add where null condition
   */
  whereNull(field: string): this {
    return this.where(field, 'isNull', null);
  }

  /**
   * Add where not null condition
   */
  whereNotNull(field: string): this {
    return this.where(field, 'isNotNull', null);
  }

  /**
   * Add where between condition
   */
  whereBetween(field: string, min: unknown, max: unknown): this {
    const tableAny = this.table as any;
    const column = tableAny[field];

    if (!column) {
      throw new Error(`Column not found: ${field}`);
    }

    this.conditions.push(between(column, min as any, max as any));
    return this;
  }

  /**
   * Add or where condition
   */
  orWhere(conditions: Array<{ field: string; operator: string; value: unknown }>): this {
    const tableAny = this.table as any;
    const orConditions = conditions
      .map(c => {
        const column = tableAny[c.field];
        if (!column) return null;
        return this.buildCondition(column, c.operator, c.value);
      })
      .filter(Boolean);

    if (orConditions.length > 0) {
      this.conditions.push(or(...orConditions));
    }

    return this;
  }

  /**
   * Add order by
   */
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    const tableAny = this.table as any;
    const column = tableAny[field];

    if (!column) {
      throw new Error(`Column not found: ${field}`);
    }

    this.sortOptions.push(direction === 'desc' ? desc(column) : asc(column));
    return this;
  }

  /**
   * Set limit
   */
  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  /**
   * Set offset
   */
  offset(value: number): this {
    this.offsetValue = value;
    return this;
  }

  /**
   * Select specific columns
   */
  select(...columns: string[]): this {
    this.selectColumns = columns;
    return this;
  }

  /**
   * Include soft deleted records
   */
  withDeleted(): this {
    this.includeSoftDeleted = true;
    return this;
  }

  /**
   * Execute and get all results
   */
  async getMany(): Promise<T[]> {
    this.applyDefaultFilters();

    let query = this.db
      .select()
      .from(this.table)
      .where(and(...this.conditions));

    if (this.sortOptions.length > 0) {
      query = query.orderBy(...this.sortOptions) as any;
    }

    if (this.limitValue !== undefined) {
      query = query.limit(this.limitValue) as any;
    }

    if (this.offsetValue !== undefined) {
      query = query.offset(this.offsetValue) as any;
    }

    return (await query) as T[];
  }

  /**
   * Execute and get first result
   */
  async getOne(): Promise<T | null> {
    const results = await this.limit(1).getMany();
    return results[0] ?? null;
  }

  /**
   * Get count
   */
  async count(): Promise<number> {
    this.applyDefaultFilters();

    const result = await this.db
      .select({ count: sql`count(*)` })
      .from(this.table)
      .where(and(...this.conditions));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Check if exists
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * Build condition from operator
   */
  private buildCondition(column: any, operator: string, value: unknown): any {
    switch (operator) {
      case 'eq':
        return eq(column, value);
      case 'neq':
        return sql`${column} != ${value}`;
      case 'gt':
        return sql`${column} > ${value}`;
      case 'gte':
        return sql`${column} >= ${value}`;
      case 'lt':
        return sql`${column} < ${value}`;
      case 'lte':
        return sql`${column} <= ${value}`;
      case 'in':
        return inArray(column, value as any[]);
      case 'like':
        return like(column, value as string);
      case 'isNull':
        return isNull(column);
      case 'isNotNull':
        return isNotNull(column);
      default:
        return eq(column, value);
    }
  }

  /**
   * Apply default filters
   */
  private applyDefaultFilters(): void {
    const tableAny = this.table as any;

    // Exclude soft deleted by default
    if (!this.includeSoftDeleted && tableAny.deletedAt) {
      this.conditions.push(isNull(tableAny.deletedAt));
    }
  }
}

/**
 * Create query builder
 */
export function createQueryBuilder<T extends Record<string, unknown>>(
  db: DrizzleDB,
  table: PgTable,
  ctx: MTPCContext
): QueryBuilder<T> {
  return new QueryBuilder<T>(db, table, ctx);
}
