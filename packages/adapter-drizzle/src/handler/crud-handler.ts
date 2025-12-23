import type { MTPCContext, PaginatedResult, QueryOptions, ResourceDefinition } from '@mtpc/core';
import { createHookExecutor } from '@mtpc/core';
import type { PgTable } from 'drizzle-orm/pg-core';
import { TenantRepository } from '../repository/tenant-repository.js';
import type { DrizzleDB } from '../types.js';

/**
 * CRUD 处理器接口
 * 定义资源的基本 CRUD 操作
 */
export interface CRUDHandler<T> {
  /** 查询资源列表 */
  list(ctx: MTPCContext, options?: QueryOptions): Promise<PaginatedResult<T>>;
  /** 创建资源 */
  create(ctx: MTPCContext, data: Partial<T>): Promise<T>;
  /** 读取单个资源 */
  read(ctx: MTPCContext, id: string): Promise<T | null>;
  /** 更新资源 */
  update(ctx: MTPCContext, id: string, data: Partial<T>): Promise<T | null>;
  /** 删除资源 */
  delete(ctx: MTPCContext, id: string): Promise<boolean>;
}

/**
 * Drizzle CRUD 处理器
 * 实现带钩子集成的 CRUD 操作
 *
 * **功能**：
 * - 完整的 CRUD 操作
 * - 钩子执行（before/after）
 * - 软删除支持
 * - 租户隔离
 */
export class DrizzleCRUDHandler<T extends Record<string, unknown>> implements CRUDHandler<T> {
  /** 租户仓储实例 */
  private repository: TenantRepository<T>;
  /** 资源定义 */
  private resource: ResourceDefinition;
  /** 钩子执行器 */
  private hookExecutor: ReturnType<typeof createHookExecutor>;

  constructor(db: DrizzleDB, table: PgTable, resource: ResourceDefinition) {
    this.repository = new TenantRepository<T>(db, table, resource.name);
    this.resource = resource;
    this.hookExecutor = createHookExecutor(resource.hooks);
  }

  /**
   * 查询资源列表
   *
   * @param ctx - MTPC 上下文
   * @param options - 查询选项
   * @returns 分页结果
   */
  async list(ctx: MTPCContext, options: QueryOptions = {}): Promise<PaginatedResult<T>> {
    // 执行 before list 钩子
    const beforeResult = await this.hookExecutor.executeBeforeList(ctx, options);
    if (!beforeResult.proceed) {
      return {
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      };
    }

    // 执行 filter query 钩子
    const filterResult = await this.hookExecutor.executeFilterQuery(ctx, options.filters ?? []);
    const filters = (filterResult as any).proceed
      ? (filterResult as any).data
      : (options.filters ?? []);
    const finalOptions = { ...beforeResult.data, filters };

    // 执行查询
    const result = await this.repository.findMany(ctx, finalOptions);

    // 执行 after list 钩子
    const afterResult = await this.hookExecutor.executeAfterList(ctx, finalOptions, result.data);
    const filteredData = (afterResult as any).proceed ? (afterResult as any).data : result.data;

    return {
      ...result,
      data: filteredData,
    };
  }

  /**
   * 创建资源
   *
   * @param ctx - MTPC 上下文
   * @param data - 资源数据
   * @returns 创建的资源
   */
  async create(ctx: MTPCContext, data: Partial<T>): Promise<T> {
    // 执行 before create 钩子
    const beforeResult = await this.hookExecutor.executeBeforeCreate(ctx, data as T);
    if (!beforeResult.proceed) {
      throw beforeResult.error ?? new Error('Create operation cancelled');
    }

    // 执行创建
    const created = await this.repository.create(ctx, beforeResult.data as Partial<T>);

    // 执行 after create 钩子
    await this.hookExecutor.executeAfterCreate(ctx, data as T, created);

    return created;
  }

  /**
   * 读取单个资源
   *
   * @param ctx - MTPC 上下文
   * @param id - 资源 ID
   * @returns 资源或 null
   */
  async read(ctx: MTPCContext, id: string): Promise<T | null> {
    // 执行 before read 钩子
    const beforeResult = await this.hookExecutor.executeBeforeRead(ctx, id);
    if (!beforeResult.proceed) {
      return null;
    }

    // 执行读取
    const record = await this.repository.findById(ctx, beforeResult.data ?? id);

    // 执行 after read 钩子
    const afterResult = await this.hookExecutor.executeAfterRead(ctx, id, record);
    return (afterResult as any).proceed ? (afterResult as any).data : record;
  }

  /**
   * 更新资源
   *
   * @param ctx - MTPC 上下文
   * @param id - 资源 ID
   * @param data - 更新数据
   * @returns 更新后的资源或 null
   */
  async update(ctx: MTPCContext, id: string, data: Partial<T>): Promise<T | null> {
    // 执行 before update 钩子
    const beforeResult = await this.hookExecutor.executeBeforeUpdate(ctx, id, data);
    if (!beforeResult.proceed) {
      return null;
    }

    // 执行更新
    const updated = await this.repository.update(ctx, id, beforeResult.data as Partial<T>);

    if (updated) {
      // 执行 after update 钩子
      await this.hookExecutor.executeAfterUpdate(ctx, id, data, updated);
    }

    return updated;
  }

  /**
   * 删除资源
   *
   * @param ctx - MTPC 上下文
   * @param id - 资源 ID
   * @returns 是否删除成功
   */
  async delete(ctx: MTPCContext, id: string): Promise<boolean> {
    // 执行 before delete 钩子
    const beforeResult = await this.hookExecutor.executeBeforeDelete(ctx, id);
    if (!beforeResult.proceed) {
      return false;
    }

    // 获取删除前的记录用于钩子
    const existing = await this.repository.findById(ctx, id);
    if (!existing) {
      return false;
    }

    // 执行删除（软删除或硬删除）
    let result: boolean;
    if (this.resource.features?.advanced?.softDelete) {
      result = await this.repository.softDelete(ctx, id);
    } else {
      result = await this.repository.delete(ctx, id);
    }

    if (result) {
      // 执行 after delete 钩子
      await this.hookExecutor.executeAfterDelete(ctx, id, existing);
    }

    return result;
  }

  /**
   * 获取仓储实例
   * 用于执行高级操作
   *
   * @returns 租户仓储实例
   */
  getRepository(): TenantRepository<T> {
    return this.repository;
  }
}
