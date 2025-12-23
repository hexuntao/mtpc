import type { MTPCContext, PaginatedResult, QueryOptions } from '@mtpc/core';
import { and, eq, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDB } from '../types.js';
import { BaseRepository } from './base-repository.js';

/**
 * Tenant-aware repository with additional features
 */
export class TenantRepository<T extends Record<string, unknown>> extends BaseRepository<T> {
  constructor(db: DrizzleDB, table: PgTable, tableName: string) {
    super(db, table, tableName);
  }

  /**
   * Find all for tenant (no pagination)
   */
  async findAllForTenant(ctx: MTPCContext): Promise<T[]> {
    const tableAny = this.table as any;

    const result = await this.db
      .select()
      .from(this.table)
      .where(eq(tableAny.tenantId, ctx.tenant.id));

    return result as T[];
  }

  /**
   * Bulk create
   */
  async createMany(ctx: MTPCContext, items: Partial<T>[]): Promise<T[]> {
    const now = new Date();

    const insertData = items.map(item => ({
      ...item,
      tenantId: ctx.tenant.id,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.subject.id,
    }));

    const result = await this.db
      .insert(this.table)
      .values(insertData as any)
      .returning();

    return result as T[];
  }

  /**
   * Bulk update
   */
  async updateMany(ctx: MTPCContext, ids: string[], data: Partial<T>): Promise<number> {
    const tableAny = this.table as any;

    const updateData = {
      ...data,
      updatedAt: new Date(),
      updatedBy: ctx.subject.id,
    };

    const result = await this.db
      .update(this.table)
      .set(updateData as any)
      .where(and(sql`${tableAny.id} = ANY(${ids})`, eq(tableAny.tenantId, ctx.tenant.id)))
      .returning();

    return result.length;
  }

  /**
   * Bulk delete
   */
  async deleteMany(ctx: MTPCContext, ids: string[]): Promise<number> {
    const tableAny = this.table as any;

    const result = await this.db
      .delete(this.table)
      .where(and(sql`${tableAny.id} = ANY(${ids})`, eq(tableAny.tenantId, ctx.tenant.id)))
      .returning();

    return result.length;
  }

  /**
   * Bulk soft delete
   */
  async softDeleteMany(ctx: MTPCContext, ids: string[]): Promise<number> {
    const tableAny = this.table as any;

    const result = await this.db
      .update(this.table)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.subject.id,
      } as any)
      .where(and(sql`${tableAny.id} = ANY(${ids})`, eq(tableAny.tenantId, ctx.tenant.id)))
      .returning();

    return result.length;
  }

  /**
   * Restore soft deleted
   */
  async restore(ctx: MTPCContext, id: string): Promise<T | null> {
    const tableAny = this.table as any;

    const result = await this.db
      .update(this.table)
      .set({
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date(),
        updatedBy: ctx.subject.id,
      } as any)
      .where(and(eq(tableAny.id, id), eq(tableAny.tenantId, ctx.tenant.id)))
      .returning();

    return (result[0] as T) ?? null;
  }

  /**
   * Find including soft deleted
   */
  async findByIdIncludingDeleted(ctx: MTPCContext, id: string): Promise<T | null> {
    const tableAny = this.table as any;

    const result = await this.db
      .select()
      .from(this.table)
      .where(and(eq(tableAny.id, id), eq(tableAny.tenantId, ctx.tenant.id)))
      .limit(1);

    return (result[0] as T) ?? null;
  }

  /**
   * Find deleted items
   */
  async findDeleted(ctx: MTPCContext, options: QueryOptions = {}): Promise<PaginatedResult<T>> {
    const tableAny = this.table as any;
    const { pagination = {} } = options;
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    // Count
    const countResult = await this.db
      .select({ count: sql`count(*)` })
      .from(this.table)
      .where(and(eq(tableAny.tenantId, ctx.tenant.id), sql`${tableAny.deletedAt} IS NOT NULL`));

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    // Data
    const data = await this.db
      .select()
      .from(this.table)
      .where(and(eq(tableAny.tenantId, ctx.tenant.id), sql`${tableAny.deletedAt} IS NOT NULL`))
      .limit(pageSize)
      .offset(offset);

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
}
