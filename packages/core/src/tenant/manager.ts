import { InvalidTenantError, TenantNotFoundError } from '@mtpc/shared';
import type { TenantContext, TenantInfo } from '../types/index.js';
import { createTenantContext, validateTenantContext } from './context.js';

/**
 * 租户存储接口
 * 定义了租户数据存储的抽象接口，支持异步操作
 * 可以实现不同的存储后端（如内存、数据库、Redis 等）
 *
 * 特性：
 * - 异步操作支持
 * - 完整的 CRUD 操作
 * - 统一的错误处理
 * - 可插拔的存储实现
 *
 * 实现要求：
 * - 所有方法必须是异步的
 * - 错误情况应抛出相应的异常
 * - ID 必须唯一且不可更改
 *
 * @example
 * ```typescript
 * // 内存存储实现
 * class InMemoryTenantStore implements TenantStore {
 *   async get(id: string): Promise<TenantInfo | null> {
 *     return this.tenants.get(id) ?? null;
 *   }
 * }
 *
 * // 数据库存储实现
 * class DatabaseTenantStore implements TenantStore {
 *   async get(id: string): Promise<TenantInfo | null> {
 *     return await db.tenants.findUnique({ where: { id } });
 *   }
 * }
 * ```
 */
export interface TenantStore {
  /**
   * 根据 ID 获取租户信息
   * @param id 租户唯一标识符
   * @returns 租户信息，如果不存在则返回 null
   */
  get(id: string): Promise<TenantInfo | null>;

  /**
   * 获取所有租户列表
   * @returns 租户信息数组
   */
  list(): Promise<TenantInfo[]>;

  /**
   * 创建新租户
   * @param info 租户信息（不包含 createdAt 和 updatedAt）
   * @returns 创建后的租户信息（包含时间戳）
   * @throws InvalidTenantError 当租户 ID 已存在时抛出
   */
  create(info: Omit<TenantInfo, 'createdAt' | 'updatedAt'>): Promise<TenantInfo>;

  /**
   * 更新租户信息
   * @param id 租户 ID
   * @param info 要更新的部分信息
   * @returns 更新后的租户信息
   * @throws TenantNotFoundError 当租户不存在时抛出
   */
  update(id: string, info: Partial<TenantInfo>): Promise<TenantInfo>;

  /**
   * 删除租户
   * @param id 租户 ID
   * @returns Promise<void>
   * @throws TenantNotFoundError 当租户不存在时抛出
   */
  delete(id: string): Promise<void>;
}

/**
 * 内存租户存储实现
 * 使用 Map 数据结构在内存中存储租户信息
 * 适用于开发、测试或小型应用
 *
 * 特性：
 * - 快速读写操作（O(1) 复杂度）
 * - 自动添加创建和更新时间戳
 * - ID 唯一性检查
 * - 简单直接的实现
 *
 * 限制：
 * - 数据不持久化（进程重启后丢失）
 * - 不支持并发写入
 * - 内存使用量随租户数量线性增长
 * - 不适合生产环境的大规模应用
 *
 * @example
 * ```typescript
 * const store = new InMemoryTenantStore();
 *
 * // 创建租户
 * const tenant = await store.create({
 *   id: 'tenant-001',
 *   name: 'ACME Corp',
 *   status: 'active'
 * });
 *
 * // 获取租户
 * const retrieved = await store.get('tenant-001');
 *
 * // 更新租户
 * await store.update('tenant-001', { status: 'suspended' });
 *
 * // 删除租户
 * await store.delete('tenant-001');
 *
 * // 清空所有数据
 * store.clear();
 * ```
 */
export class InMemoryTenantStore implements TenantStore {
  /**
   * 内部存储，使用 Map 映射租户 ID 到租户信息
   * Map 提供了快速的查找、插入和删除操作
   */
  private tenants: Map<string, TenantInfo> = new Map();

  /**
   * 根据 ID 获取租户信息
   * @param id 租户唯一标识符
   * @returns 租户信息，如果不存在则返回 null
   */
  async get(id: string): Promise<TenantInfo | null> {
    return this.tenants.get(id) ?? null;
  }

  /**
   * 获取所有租户列表
   * @returns 租户信息数组
   */
  async list(): Promise<TenantInfo[]> {
    // 从 Map 中获取所有值并转换为数组
    return Array.from(this.tenants.values());
  }

  /**
   * 创建新租户
   * 自动添加创建和更新时间戳
   * @param info 租户信息（不包含 createdAt 和 updatedAt）
   * @returns 创建后的租户信息（包含时间戳）
   * @throws InvalidTenantError 当租户 ID 无效或已存在时抛出
   */
  async create(info: Omit<TenantInfo, 'createdAt' | 'updatedAt'>): Promise<TenantInfo> {
    // 验证租户 ID
    if (!info.id || typeof info.id !== 'string' || info.id.trim() === '') {
      throw new InvalidTenantError('Tenant ID must be a non-empty string');
    }

    // 检查 ID 是否已存在
    if (this.tenants.has(info.id)) {
      throw new InvalidTenantError(`Tenant ${info.id} already exists`);
    }

    // 验证状态（如果提供）
    if (info.status && !['active', 'suspended', 'deleted'].includes(info.status)) {
      throw new InvalidTenantError(`Invalid tenant status: ${info.status}`);
    }

    // 创建时间戳
    const now = new Date();
    const tenant: TenantInfo = {
      ...info,
      createdAt: now,
      updatedAt: now,
    };

    // 存储到 Map
    this.tenants.set(info.id, tenant);
    return tenant;
  }

  /**
   * 更新租户信息
   * 自动更新 updatedAt 时间戳，保留原有 createdAt
   * @param id 租户 ID
   * @param info 要更新的部分信息
   * @returns 更新后的租户信息
   * @throws TenantNotFoundError 当租户不存在时抛出
   */
  async update(id: string, info: Partial<TenantInfo>): Promise<TenantInfo> {
    // 获取现有租户信息
    const existing = this.tenants.get(id);

    if (!existing) {
      throw new TenantNotFoundError(id);
    }

    // 合并更新信息，确保 ID 不被更改
    const updated: TenantInfo = {
      ...existing,
      ...info,
      id, // 强制保持原有 ID，不允许更改
      updatedAt: new Date(),
    };

    this.tenants.set(id, updated);
    return updated;
  }

  /**
   * 删除租户
   * 从存储中完全移除租户信息
   * @param id 租户 ID
   * @returns Promise<void>
   * @throws TenantNotFoundError 当租户不存在时抛出
   */
  async delete(id: string): Promise<void> {
    // 检查租户是否存在
    if (!this.tenants.has(id)) {
      throw new TenantNotFoundError(id);
    }

    // 从 Map 中删除
    this.tenants.delete(id);
  }

  /**
   * 清空所有租户数据
   * 谨慎使用，会删除所有租户信息且无法恢复
   */
  clear(): void {
    this.tenants.clear();
  }
}

/**
 * 租户管理器
 * 提供高级的租户管理功能，包括缓存、验证和上下文创建
 * 封装了存储层，提供更丰富的业务逻辑
 *
 * 特性：
 * - 内置缓存机制，提高读取性能
 * - 缓存 TTL（生存时间）控制
 * - 自动缓存失效
 * - 上下文创建和验证
 * - 统一的租户操作接口
 *
 * 缓存机制：
 * - 使用 Map 存储缓存数据
 * - 每个缓存项包含租户信息和过期时间
 * - 自动检查过期时间，过期后重新从存储获取
 * - 创建、更新、删除操作自动失效相关缓存
 *
 * @example
 * ```typescript
 * const store = new InMemoryTenantStore();
 * const manager = new TenantManager(store, { cacheTtl: 60000 });
 *
 * // 获取租户（使用缓存）
 * const tenant = await manager.getTenant('tenant-001');
 *
 * // 创建租户上下文
 * const context = await manager.createContext('tenant-001');
 *
 * // 验证并获取上下文
 * const validContext = await manager.validateAndGetContext('tenant-001');
 *
 * // 创建租户（自动失效缓存）
 * await manager.createTenant({
 *   id: 'tenant-002',
 *   name: 'New Corp'
 * });
 * ```
 */
export class TenantManager {
  /**
   * 租户存储后端
   * 负责实际的持久化操作
   */
  private store: TenantStore;

  /**
   * 租户缓存
   * 键为租户 ID，值为包含租户信息和过期时间的对象
   */
  private cache: Map<string, { tenant: TenantInfo; expiresAt: number }> = new Map();

  /**
   * 缓存生存时间（毫秒）
   * 默认 60000ms（1 分钟）
   */
  private cacheTtl: number;

  /**
   * 创建租户管理器
   * @param store 租户存储后端
   * @param options 配置选项
   * @param options.cacheTtl 缓存生存时间（毫秒），默认 60000
   * @throws InvalidTenantError 当参数无效时抛出
   */
  constructor(store: TenantStore, options?: { cacheTtl?: number }) {
    // 验证 store 参数
    if (!store) {
      throw new InvalidTenantError('Tenant store is required');
    }

    // 验证 cacheTtl 参数
    const cacheTtl = options?.cacheTtl ?? 60000;
    if (typeof cacheTtl !== 'number' || cacheTtl <= 0) {
      throw new InvalidTenantError('Cache TTL must be a positive number');
    }

    this.store = store;
    this.cacheTtl = cacheTtl;
  }

  /**
   * 根据 ID 获取租户信息
   * 优先从缓存获取，缓存不存在或过期时从存储获取
   * @param id 租户唯一标识符
   * @returns 租户信息，如果不存在则返回 null
   */
  async getTenant(id: string): Promise<TenantInfo | null> {
    // 1. 检查缓存
    const cached = this.cache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      // 缓存未过期，返回缓存数据
      return cached.tenant;
    }

    // 2. 从存储获取
    const tenant = await this.store.get(id);

    if (tenant) {
      // 3. 将数据存入缓存
      this.cache.set(id, {
        tenant,
        expiresAt: Date.now() + this.cacheTtl,
      });
    }

    return tenant;
  }

  /**
   * 根据 ID 获取租户信息（安全版本）
   * 租户不存在时抛出异常
   * @param id 租户唯一标识符
   * @returns 租户信息
   * @throws TenantNotFoundError 当租户不存在时抛出
   */
  async getTenantOrThrow(id: string): Promise<TenantInfo> {
    const tenant = await this.getTenant(id);

    if (!tenant) {
      throw new TenantNotFoundError(id);
    }

    return tenant;
  }

  /**
   * 根据 ID 创建租户上下文
   * 从存储获取租户信息并转换为上下文对象
   * @param id 租户唯一标识符
   * @returns 租户上下文对象
   * @throws TenantNotFoundError 当租户不存在时抛出
   */
  async createContext(id: string): Promise<TenantContext> {
    // 获取租户信息
    const tenant = await this.getTenantOrThrow(id);
    // 创建租户上下文
    return createTenantContext(tenant.id, {
      status: tenant.status,
      metadata: tenant.metadata,
    });
  }

  /**
   * 验证并获取租户上下文
   * 创建上下文后立即验证其有效性
   * 适用于需要确保租户可用的场景
   * @param id 租户唯一标识符
   * @returns 验证通过的租户上下文对象
   * @throws TenantNotFoundError 当租户不存在时抛出
   * @throws InvalidTenantError 当租户状态无效时抛出
   */
  async validateAndGetContext(id: string): Promise<TenantContext> {
    // 创建上下文
    const context = await this.createContext(id);
    // 验证上下文
    validateTenantContext(context);
    return context;
  }

  /**
   * 获取所有租户列表
   * 注意：此操作不经过缓存，直接从存储获取
   * @returns 租户信息数组
   */
  async listTenants(): Promise<TenantInfo[]> {
    return this.store.list();
  }

  /**
   * 创建租户
   * 创建后自动失效相关缓存，确保数据一致性
   * @param info 租户信息（不包含 createdAt 和 updatedAt）
   * @returns 创建后的租户信息（包含时间戳）
   * @throws InvalidTenantError 当租户信息无效时抛出
   */
  async createTenant(info: Omit<TenantInfo, 'createdAt' | 'updatedAt'>): Promise<TenantInfo> {
    // 验证输入参数
    if (!info) {
      throw new InvalidTenantError('Tenant info is required');
    }

    // 创建租户
    const tenant = await this.store.create(info);
    // 失效缓存
    this.invalidateCache(tenant.id);
    return tenant;
  }

  /**
   * 更新租户
   * 更新后自动失效相关缓存，确保数据一致性
   * @param id 租户 ID
   * @param info 要更新的部分信息
   * @returns 更新后的租户信息
   * @throws InvalidTenantError 当参数无效时抛出
   * @throws TenantNotFoundError 当租户不存在时抛出
   */
  async updateTenant(id: string, info: Partial<TenantInfo>): Promise<TenantInfo> {
    // 验证 id 参数
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new InvalidTenantError('Tenant ID must be a non-empty string');
    }

    // 更新租户
    const tenant = await this.store.update(id, info);
    // 失效缓存
    this.invalidateCache(id);
    return tenant;
  }

  /**
   * 删除租户
   * 删除后自动失效相关缓存，确保数据一致性
   * @param id 租户 ID
   * @returns Promise<void>
   * @throws InvalidTenantError 当参数无效时抛出
   * @throws TenantNotFoundError 当租户不存在时抛出
   */
  async deleteTenant(id: string): Promise<void> {
    // 验证 id 参数
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new InvalidTenantError('Tenant ID must be a non-empty string');
    }

    // 删除租户
    await this.store.delete(id);
    // 失效缓存
    this.invalidateCache(id);
  }

  /**
   * 使指定租户的缓存失效
   * 在创建、更新、删除操作后调用
   * @param id 租户唯一标识符
   */
  invalidateCache(id: string): void {
    this.cache.delete(id);
  }

  /**
   * 清空所有缓存
   * 谨慎使用，会清除所有租户的缓存数据
   * 适用于需要强制刷新所有缓存的场景
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * 创建租户管理器（带内存存储的工厂函数）
 * 便捷函数，快速创建带内存存储的租户管理器
 * 适用于开发、测试或小型应用
 *
 * 特性：
 * - 快速初始化
 * - 内置内存存储
 * - 可配置缓存 TTL
 * - 开箱即用
 *
 * @param options 配置选项
 * @param options.cacheTtl 缓存生存时间（毫秒），默认 60000
 * @returns 租户管理器实例
 *
 * @example
 * ```typescript
 * // 使用默认配置
 * const manager = createTenantManager();
 *
 * // 自定义缓存 TTL
 * const manager = createTenantManager({ cacheTtl: 300000 }); // 5 分钟
 *
 * // 创建租户
 * await manager.createTenant({
 *   id: 'tenant-001',
 *   name: 'ACME Corp',
 *   status: 'active'
 * });
 *
 * // 获取租户
 * const tenant = await manager.getTenant('tenant-001');
 * ```
 */
export function createTenantManager(options?: { cacheTtl?: number }): TenantManager {
  return new TenantManager(new InMemoryTenantStore(), options);
}
