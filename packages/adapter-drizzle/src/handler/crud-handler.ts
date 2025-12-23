import type { MTPCContext, PaginatedResult, QueryOptions, ResourceDefinition } from '@mtpc/core';
import { createHookExecutor } from '@mtpc/core';
import type { PgTable } from 'drizzle-orm/pg-core';
import { TenantRepository } from '../repository/tenant-repository.js';
import type { DrizzleDB } from '../types.js';

/**
 * CRUD handler interface
 */
export interface CRUDHandler<T> {
  list(ctx: MTPCContext, options?: QueryOptions): Promise<PaginatedResult<T>>;
  create(ctx: MTPCContext, data: Partial<T>): Promise<T>;
  read(ctx: MTPCContext, id: string): Promise<T | null>;
  update(ctx: MTPCContext, id: string, data: Partial<T>): Promise<T | null>;
  delete(ctx: MTPCContext, id: string): Promise<boolean>;
}

/**
 * Drizzle CRUD handler
 */
export class DrizzleCRUDHandler<T extends Record<string, unknown>> implements CRUDHandler<T> {
  private repository: TenantRepository<T>;
  private resource: ResourceDefinition;
  private hookExecutor: ReturnType<typeof createHookExecutor>;

  constructor(db: DrizzleDB, table: PgTable, resource: ResourceDefinition) {
    this.repository = new TenantRepository<T>(db, table, resource.name);
    this.resource = resource;
    this.hookExecutor = createHookExecutor(resource.hooks);
  }

  /**
   * List records
   */
  async list(ctx: MTPCContext, options: QueryOptions = {}): Promise<PaginatedResult<T>> {
    // Execute before list hooks
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

    // Execute filter query hooks
    const filters = await this.hookExecutor.executeFilterQuery(ctx, options.filters ?? []);
    const finalOptions = { ...beforeResult.data, filters };

    // Execute query
    const result = await this.repository.findMany(ctx, finalOptions);

    // Execute after list hooks
    const filteredData = await this.hookExecutor.executeAfterList(ctx, finalOptions, result.data);

    return {
      ...result,
      data: filteredData,
    };
  }

  /**
   * Create record
   */
  async create(ctx: MTPCContext, data: Partial<T>): Promise<T> {
    // Execute before create hooks
    const beforeResult = await this.hookExecutor.executeBeforeCreate(ctx, data as T);
    if (!beforeResult.proceed) {
      throw beforeResult.error ?? new Error('Create operation cancelled');
    }

    // Execute create
    const created = await this.repository.create(ctx, beforeResult.data as Partial<T>);

    // Execute after create hooks
    await this.hookExecutor.executeAfterCreate(ctx, data as T, created);

    return created;
  }

  /**
   * Read record
   */
  async read(ctx: MTPCContext, id: string): Promise<T | null> {
    // Execute before read hooks
    const beforeResult = await this.hookExecutor.executeBeforeRead(ctx, id);
    if (!beforeResult.proceed) {
      return null;
    }

    // Execute read
    const record = await this.repository.findById(ctx, beforeResult.data ?? id);

    // Execute after read hooks
    return await this.hookExecutor.executeAfterRead(ctx, id, record);
  }

  /**
   * Update record
   */
  async update(ctx: MTPCContext, id: string, data: Partial<T>): Promise<T | null> {
    // Execute before update hooks
    const beforeResult = await this.hookExecutor.executeBeforeUpdate(ctx, id, data);
    if (!beforeResult.proceed) {
      return null;
    }

    // Execute update
    const updated = await this.repository.update(ctx, id, beforeResult.data as Partial<T>);

    if (updated) {
      // Execute after update hooks
      await this.hookExecutor.executeAfterUpdate(ctx, id, data, updated);
    }

    return updated;
  }

  /**
   * Delete record
   */
  async delete(ctx: MTPCContext, id: string): Promise<boolean> {
    // Execute before delete hooks
    const beforeResult = await this.hookExecutor.executeBeforeDelete(ctx, id);
    if (!beforeResult.proceed) {
      return false;
    }

    // Get record before delete for hooks
    const existing = await this.repository.findById(ctx, id);
    if (!existing) {
      return false;
    }

    // Execute delete (soft or hard based on features)
    let result: boolean;
    if (this.resource.features.advanced.softDelete) {
      result = await this.repository.softDelete(ctx, id);
    } else {
      result = await this.repository.delete(ctx, id);
    }

    if (result) {
      // Execute after delete hooks
      await this.hookExecutor.executeAfterDelete(ctx, id, existing);
    }

    return result;
  }

  /**
   * Get repository for advanced operations
   */
  getRepository(): TenantRepository<T> {
    return this.repository;
  }
}
