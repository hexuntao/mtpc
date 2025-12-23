import type { MTPCContext, PaginatedResult, QueryOptions, ResourceDefinition } from '@mtpc/core';
import type { CRUDHandlers } from '../types.js';

/**
 * 基础实体类型，包含常见字段
 *
 * @template T - 实体类型，必须继承 BaseEntity
 */
interface BaseEntity {
  /** 实体唯一标识 */
  id: string;
  /** 所属租户 ID */
  tenantId: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 创建者 ID（可选） */
  createdBy?: string;
}

/**
 * CRUD 处理器抽象基类
 * 实现自定义 CRUD 处理器时可以继承此类
 *
 * @template T - 实体类型，必须继承 BaseEntity
 */
export abstract class BaseCRUDHandler<T extends BaseEntity> implements CRUDHandlers<T> {
  /** 资源定义 */
  protected resource: ResourceDefinition;

  /**
   * 构造函数
   * @param resource - 资源定义对象
   */
  constructor(resource: ResourceDefinition) {
    this.resource = resource;
  }

  /** 分页查询资源列表 */
  abstract list(ctx: MTPCContext, options: QueryOptions): Promise<PaginatedResult<T>>;

  /** 创建新资源 */
  abstract create(ctx: MTPCContext, data: unknown): Promise<T>;

  /** 读取单个资源 */
  abstract read(ctx: MTPCContext, id: string): Promise<T | null>;

  /** 更新资源 */
  abstract update(ctx: MTPCContext, id: string, data: unknown): Promise<T | null>;

  /** 删除资源 */
  abstract delete(ctx: MTPCContext, id: string): Promise<boolean>;
}

/**
 * 内存 CRUD 处理器（仅供测试/演示使用）
 *
 * @warning 此实现使用内存存储，数据在进程重启后会丢失
 * @internal 此类仅用于测试和开发，生产环境请使用数据库实现
 *
 * **数据验证说明**：
 * - 此实现使用 createSchema/updateSchema 进行数据验证
 * - 验证失败时会抛出 Zod 验证错误
 * - 这确保了类型安全，避免运行时隐式错误
 *
 * @template T - 实体类型，必须继承 BaseEntity
 *
 * @example
 * ```typescript
 * // 仅用于测试
 * const handler = new InMemoryCRUDHandler(userResource);
 * await handler.create(ctx, { name: 'test' });
 * ```
 */
export class InMemoryCRUDHandler<T extends BaseEntity> extends BaseCRUDHandler<T> {
  /** 内存存储，键为资源 ID */
  private store: Map<string, T> = new Map();
  /** 自增 ID 计数器 */
  private idCounter = 0;

  /**
   * 构造函数
   * @param resource - 资源定义对象
   */
  constructor(resource: ResourceDefinition) {
    super(resource);
  }

  /**
   * 分页查询资源列表
   * 自动按租户 ID 过滤，确保租户隔离
   */
  async list(ctx: MTPCContext, options: QueryOptions): Promise<PaginatedResult<T>> {
    const page = options.pagination?.page ?? 1;
    const pageSize = options.pagination?.pageSize ?? 20;

    // 按租户 ID 过滤，确保多租户隔离
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

  /**
   * 创建新资源
   * 自动设置 ID、租户 ID、创建时间等字段
   *
   * **修复说明**：使用 createSchema 验证数据，确保类型安全
   */
  async create(ctx: MTPCContext, data: unknown): Promise<T> {
    // 使用 createSchema 验证数据
    const validatedData = this.resource.createSchema.parse(data);

    const id = String(++this.idCounter);
    const now = new Date();

    // 合并用户数据和系统字段
    // 使用 Object.assign 确保类型安全
    const record: T = Object.assign({}, validatedData, {
      id,
      tenantId: ctx.tenant.id,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.subject.id,
    }) as T;

    this.store.set(id, record);
    return record;
  }

  /**
   * 读取单个资源
   * 只能读取当前租户的资源
   */
  async read(ctx: MTPCContext, id: string): Promise<T | null> {
    const record = this.store.get(id);

    // 租户隔离检查：只能读取当前租户的资源
    if (!record || record.tenantId !== ctx.tenant.id) {
      return null;
    }

    return record;
  }

  /**
   * 更新资源
   * 只能更新当前租户的资源
   *
   * **修复说明**：使用 updateSchema 验证数据，确保类型安全
   */
  async update(ctx: MTPCContext, id: string, data: unknown): Promise<T | null> {
    const existing = this.store.get(id);

    // 租户隔离检查：只能更新当前租户的资源
    if (!existing || existing.tenantId !== ctx.tenant.id) {
      return null;
    }

    // 使用 updateSchema 验证数据
    const validatedData = this.resource.updateSchema.parse(data);

    // 合并现有数据和新数据，保留不可变字段
    const updated: T = Object.assign({}, existing, validatedData, {
      id, // 确保 ID 不被覆盖
      tenantId: ctx.tenant.id, // 确保租户 ID 不被覆盖
      updatedAt: new Date(), // 更新修改时间
    }) as T;

    this.store.set(id, updated);
    return updated;
  }

  /**
   * 删除资源
   * 只能删除当前租户的资源
   */
  async delete(ctx: MTPCContext, id: string): Promise<boolean> {
    const existing = this.store.get(id);

    // 租户隔离检查：只能删除当前租户的资源
    if (!existing || existing.tenantId !== ctx.tenant.id) {
      return false;
    }

    this.store.delete(id);
    return true;
  }

  /**
   * 清空所有数据（仅供测试使用）
   * @internal
   */
  clear(): void {
    this.store.clear();
    this.idCounter = 0;
  }
}

/**
 * 创建内存处理器工厂函数
 *
 * @warning 此函数返回的处理器使用内存存储，仅供测试/演示使用
 * @internal
 *
 * @returns 返回一个根据资源名称缓存的处理器工厂
 *
 * @example
 * ```typescript
 * // 仅用于测试
 * const factory = createInMemoryHandlerFactory();
 * const userHandler = factory(userResource);
 * ```
 */
export function createInMemoryHandlerFactory(): <T extends BaseEntity>(
  resource: ResourceDefinition
) => InMemoryCRUDHandler<T> {
  // 使用 Map 缓存处理器，每个资源名称对应一个处理器实例
  // 这样可以在多个请求间共享数据（仅对内存存储有意义）
  const handlers = new Map<string, InMemoryCRUDHandler<BaseEntity>>();

  return <T extends BaseEntity>(resource: ResourceDefinition): InMemoryCRUDHandler<T> => {
    let handler = handlers.get(resource.name);

    if (!handler) {
      handler = new InMemoryCRUDHandler<BaseEntity>(resource);
      handlers.set(resource.name, handler);
    }

    // 类型断言：我们确定泛型类型是一致的
    // 由于 InMemoryCRUDHandler 的泛型 T 在运行时被擦除
    // 且 BaseEntity 包含了所有必要字段，这个断言是安全的
    return handler as InMemoryCRUDHandler<T>;
  };
}
