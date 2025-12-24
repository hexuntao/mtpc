import type { MTPCContext, PaginatedResult, QueryOptions } from '@mtpc/core';
import { and, eq, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDB } from '../types.js';
import { BaseRepository, type RepositoryOptions } from './base-repository.js';

/**
 * 租户仓储类
 * 扩展基础仓储，提供租户相关的批量操作和软删除功能
 *
 * **功能**：
 * - 所有租户数据的查询
 * - 批量创建、更新、删除
 * - 软删除恢复
 * - 包含已删除数据的查询
 */
export class TenantRepository<T extends Record<string, unknown>> extends BaseRepository<T> {
  constructor(db: DrizzleDB, table: PgTable, tableName: string, options: RepositoryOptions = {}) {
    super(db, table, tableName, options);
  }

  /**
   * 查询租户的所有数据（无分页）
   *
   * @param ctx - MTPC 上下文
   * @returns 所有记录
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
   * 批量创建记录
   *
   * @param ctx - MTPC 上下文
   * @param items - 记录数据数组
   * @returns 创建的记录数组
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
   * 批量更新记录
   *
   * @param ctx - MTPC 上下文
   * @param ids - 记录 ID 数组
   * @param data - 更新数据
   * @returns 更新的记录数量
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
   * 批量删除记录（硬删除）
   *
   * @param ctx - MTPC 上下文
   * @param ids - 记录 ID 数组
   * @returns 删除的记录数量
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
   * 批量软删除记录
   *
   * @param ctx - MTPC 上下文
   * @param ids - 记录 ID 数组
   * @returns 删除的记录数量
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
   * 恢复软删除的记录
   *
   * @param ctx - MTPC 上下文
   * @param id - 记录 ID
   * @returns 恢复的记录或 null
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
   * 查找记录（包含已软删除的）
   *
   * @param ctx - MTPC 上下文
   * @param id - 记录 ID
   * @returns 记录或 null
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
   * 查询已删除的记录
   *
   * @param ctx - MTPC 上下文
   * @param options - 查询选项
   * @returns 已删除记录的分页结果
   */
  async findDeleted(ctx: MTPCContext, options: QueryOptions = {}): Promise<PaginatedResult<T>> {
    const tableAny = this.table as any;
    const { pagination = {} } = options;
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    // 计数
    const countResult = await this.db
      .select({ count: sql`count(*)` })
      .from(this.table)
      .where(and(eq(tableAny.tenantId, ctx.tenant.id), sql`${tableAny.deletedAt} IS NOT NULL`));

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    // 数据查询
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
