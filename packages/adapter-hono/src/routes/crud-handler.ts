import type { MTPCContext, PaginatedResult, QueryOptions, ResourceDefinition } from '@mtpc/core';

/**
 * CRUD handler interface
 */

/**
 * Abstract CRUD handler base class
 */
export class BaseCRUDHandler {
  constructor(resource) {
    this.resource = resource;
  }

  async list(ctx, options) {
    throw new Error('list not implemented');
  }

  async create(ctx, data) {
    throw new Error('create not implemented');
  }

  async read(ctx, id) {
    throw new Error('read not implemented');
  }

  async update(ctx, id, data) {
    throw new Error('update not implemented');
  }

  async delete(ctx, id) {
    throw new Error('delete not implemented');
  }
}

/**
 * In-memory CRUD handler for testing
 */
export class InMemoryCRUDHandler extends BaseCRUDHandler {
  constructor(resource) {
    super(resource);
    this.store = new Map();
    this.idCounter = 0;
  }

  async list(ctx, options) {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;

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

  async create(ctx, data) {
    const id = String(++this.idCounter);
    const now = new Date();

    const record = {
      ...data,
      id,
      tenantId: ctx.tenant.id,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.subject.id,
    };

    this.store.set(id, record);
    return record;
  }

  async read(ctx, id) {
    const record = this.store.get(id);

    if (!record || record.tenantId !== ctx.tenant.id) {
      return null;
    }

    return record;
  }

  async update(ctx, id, data) {
    const existing = this.store.get(id);

    if (!existing || existing.tenantId !== ctx.tenant.id) {
      return null;
    }

    const updated = {
      ...existing,
      ...data,
      id,
      tenantId: ctx.tenant.id,
      updatedAt: new Date(),
      updatedBy: ctx.subject.id,
    };

    this.store.set(id, updated);
    return updated;
  }

  async delete(ctx, id) {
    const existing = this.store.get(id);

    if (!existing || existing.tenantId !== ctx.tenant.id) {
      return false;
    }

    this.store.delete(id);
    return true;
  }

  clear() {
    this.store.clear();
    this.idCounter = 0;
  }
}

/**
 * Create in-memory handler factory
 */
export function createInMemoryHandlerFactory() {
  const handlers = new Map();

  return resource => {
    let handler = handlers.get(resource.name);

    if (!handler) {
      handler = new InMemoryCRUDHandler(resource);
      handlers.set(resource.name, handler);
    }

    return handler;
  };
}
