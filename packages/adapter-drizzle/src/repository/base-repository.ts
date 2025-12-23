import type {
  FilterCondition,
  MTPCContext,
  PaginatedResult,
  QueryOptions,
  SortOptions,
} from '@mtpc/core';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDB, Repository } from '../types.js';

/**
 * Base repository class
 */
export class BaseRepository<T extends Record<string, unknown>> implements Repository<T> {
  protected db: DrizzleDB;
  protected table: PgTable;
  protected tableName: string;

  constructor(db: DrizzleDB, table: PgTable, tableName: string) {
    this.db = db;
    this.table = table;
    this.tableName = tableName;
  }

  /**
   * Find by ID
   */
  async findById(ctx: MTPCContext, id: string): Promise<T | null> {
    const tableAny = this.table as any;

    const result = await this.db
      .select()
      .from(this.table)
      .where(and(eq(tableAny.id, id), eq(tableAny.tenantId, ctx.tenant.id)))
      .limit(1);

    return (result[0] as T) ?? null;
  }

  /**
   * Find many with pagination
   */
  async findMany(ctx: MTPCContext, options: QueryOptions = {}): Promise<PaginatedResult<T>> {
    const { pagination = {}, sort = [], filters = [] } = options;
    const { page = 1, pageSize = 20 } = pagination;

    const tableAny = this.table as any;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = this.buildWhereConditions(ctx, filters);

    // Build order by
    const orderBy = this.buildOrderBy(sort);

    // Execute count query
    const countResult = await this.db.select({ count: count() }).from(this.table).where(conditions);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    // Execute data query
    let query = this.db.select().from(this.table).where(conditions).limit(pageSize).offset(offset);

    if (orderBy.length > 0) {
      query = query.orderBy(...orderBy) as any;
    }

    const data = await query;

    return {
      data: data as T[],
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Create record
   */
  async create(ctx: MTPCContext, data: Partial<T>): Promise<T> {
    const now = new Date();

    const insertData = {
      ...data,
      tenantId: ctx.tenant.id,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.subject.id,
    };

    const result = await this.db
      .insert(this.table)
      .values(insertData as any)
      .returning();

    return result[0] as T;
  }

  /**
   * Update record
   */
  async update(ctx: MTPCContext, id: string, data: Partial<T>): Promise<T | null> {
    const tableAny = this.table as any;

    const updateData = {
      ...data,
      updatedAt: new Date(),
      updatedBy: ctx.subject.id,
    };

    const result = await this.db
      .update(this.table)
      .set(updateData as any)
      .where(and(eq(tableAny.id, id), eq(tableAny.tenantId, ctx.tenant.id)))
      .returning();

    return (result[0] as T) ?? null;
  }

  /**
   * Delete record
   */
  async delete(ctx: MTPCContext, id: string): Promise<boolean> {
    const tableAny = this.table as any;

    const result = await this.db
      .delete(this.table)
      .where(and(eq(tableAny.id, id), eq(tableAny.tenantId, ctx.tenant.id)))
      .returning();

    return result.length > 0;
  }

  /**
   * Soft delete record
   */
  async softDelete(ctx: MTPCContext, id: string): Promise<boolean> {
    const tableAny = this.table as any;

    const result = await this.db
      .update(this.table)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.subject.id,
      } as any)
      .where(and(eq(tableAny.id, id), eq(tableAny.tenantId, ctx.tenant.id)))
      .returning();

    return result.length > 0;
  }

  /**
   * Count records
   */
  async count(ctx: MTPCContext, options: QueryOptions = {}): Promise<number> {
    const { filters = [] } = options;
    const conditions = this.buildWhereConditions(ctx, filters);

    const result = await this.db.select({ count: count() }).from(this.table).where(conditions);

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Find one by conditions
   */
  async findOne(ctx: MTPCContext, conditions: FilterCondition[]): Promise<T | null> {
    const whereConditions = this.buildWhereConditions(ctx, conditions);

    const result = await this.db.select().from(this.table).where(whereConditions).limit(1);

    return (result[0] as T) ?? null;
  }

  /**
   * Check if exists
   */
  async exists(ctx: MTPCContext, id: string): Promise<boolean> {
    const tableAny = this.table as any;

    const result = await this.db
      .select({ count: count() })
      .from(this.table)
      .where(and(eq(tableAny.id, id), eq(tableAny.tenantId, ctx.tenant.id)));

    return Number(result[0]?.count ?? 0) > 0;
  }

  /**
   * Build where conditions
   */
  protected buildWhereConditions(ctx: MTPCContext, filters: FilterCondition[]) {
    const tableAny = this.table as any;
    const conditions: any[] = [eq(tableAny.tenantId, ctx.tenant.id)];

    // Exclude soft deleted by default
    if (tableAny.deletedAt) {
      conditions.push(isNull(tableAny.deletedAt));
    }

    for (const filter of filters) {
      const column = tableAny[filter.field];
      if (!column) continue;

      switch (filter.operator) {
        case 'eq':
          conditions.push(eq(column, filter.value));
          break;
        case 'neq':
          conditions.push(sql`${column} != ${filter.value}`);
          break;
        case 'gt':
          conditions.push(sql`${column} > ${filter.value}`);
          break;
        case 'gte':
          conditions.push(sql`${column} >= ${filter.value}`);
          break;
        case 'lt':
          conditions.push(sql`${column} < ${filter.value}`);
          break;
        case 'lte':
          conditions.push(sql`${column} <= ${filter.value}`);
          break;
        case 'in':
          if (Array.isArray(filter.value)) {
            conditions.push(inArray(column, filter.value));
          }
          break;
        case 'contains':
          conditions.push(like(column, `%${filter.value}%`));
          break;
        case 'startsWith':
          conditions.push(like(column, `${filter.value}%`));
          break;
        case 'endsWith':
          conditions.push(like(column, `%${filter.value}`));
          break;
        case 'isNull':
          conditions.push(isNull(column));
          break;
        case 'isNotNull':
          conditions.push(isNotNull(column));
          break;
      }
    }

    return and(...conditions);
  }

  /**
   * Build order by
   */
  protected buildOrderBy(sort: SortOptions[]): any[] {
    const tableAny = this.table as any;
    const orderBy: any[] = [];

    for (const s of sort) {
      const column = tableAny[s.field];
      if (!column) continue;

      orderBy.push(s.direction === 'desc' ? desc(column) : asc(column));
    }

    // Default sort by createdAt desc
    if (orderBy.length === 0 && tableAny.createdAt) {
      orderBy.push(desc(tableAny.createdAt));
    }

    return orderBy;
  }
}
