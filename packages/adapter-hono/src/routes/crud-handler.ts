import type { MTPCContext, PaginatedResult, QueryOptions, ResourceDefinition } from '@mtpc/core';
import type { CRUDHandlers } from '../types.js';

/**
 * Base entity type with common fields
 */
interface BaseEntity {
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Abstract CRUD handler base class
 */
export abstract class BaseCRUDHandler<T extends BaseEntity> implements CRUDHandlers<T> {
  protected resource: ResourceDefinition;

  constructor(resource: ResourceDefinition) {
    this.resource = resource;
  }

  abstract list(ctx: MTPCContext, options: QueryOptions): Promise<PaginatedResult<T>>;
  abstract create(ctx: MTPCContext, data: unknown): Promise<T>;
  abstract read(ctx: MTPCContext, id: string): Promise<T | null>;
  abstract update(ctx: MTPCContext, id: string, data: unknown): Promise<T | null>;
  abstract delete(ctx: MTPCContext, id: string): Promise<boolean>;
}

/**
 * In-memory CRUD handler for testing
 */
export class InMemoryCRUDHandler<T extends BaseEntity> extends BaseCRUDHandler<T> {
  private store: Map<string, T> = new Map();
  private idCounter = 0;

  constructor(resource: ResourceDefinition) {
    super(resource);
  }

  async list(ctx: MTPCContext, options: QueryOptions): Promise<PaginatedResult<T>> {
    const page = options.pagination?.page ?? 1;
    const pageSize = options.pagination?.pageSize ?? 20;

    // Filter by tenant
    const items = Array.from(this.store.values()).filter(item => item.tenantId === ctx.tenant.id);

    const total = items.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const data = items.slice(start, start + pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async create(ctx: MTPCContext, data: unknown): Promise<T> {
    const id = String(++this.idCounter);
    const now = new Date();

    const record = {
      ...(data as Partial<T>),
      id,
      tenantId: ctx.tenant.id,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.subject.id,
    } as T;

    this.store.set(id, record);
    return record;
  }

  async read(ctx: MTPCContext, id: string): Promise<T | null> {
    const record = this.store.get(id);

    if (!record || record.tenantId !== ctx.tenant.id) {
      return null;
    }

    return record;
  }

  async update(ctx: MTPCContext, id: string, data: unknown): Promise<T | null> {
    const existing = this.store.get(id);

    if (!existing || existing.tenantId !== ctx.tenant.id) {
      return null;
    }

    const updated: T = {
      ...existing,
      ...(data as Partial<T>),
      id,
      tenantId: ctx.tenant.id,
      updatedAt: new Date(),
    };

    this.store.set(id, updated);
    return updated;
  }

  async delete(ctx: MTPCContext, id: string): Promise<boolean> {
    const existing = this.store.get(id);

    if (!existing || existing.tenantId !== ctx.tenant.id) {
      return false;
    }

    this.store.delete(id);
    return true;
  }

  clear(): void {
    this.store.clear();
    this.idCounter = 0;
  }
}

/**
 * Create in-memory handler factory
 */
export function createInMemoryHandlerFactory(): <T extends BaseEntity>(
  resource: ResourceDefinition
) => InMemoryCRUDHandler<T> {
  const handlers = new Map<string, InMemoryCRUDHandler<BaseEntity>>();

  return <T extends BaseEntity>(resource: ResourceDefinition): InMemoryCRUDHandler<T> => {
    let handler = handlers.get(resource.name);

    if (!handler) {
      handler = new InMemoryCRUDHandler<BaseEntity>(resource);
      handlers.set(resource.name, handler);
    }

    return handler as InMemoryCRUDHandler<T>;
  };
}
