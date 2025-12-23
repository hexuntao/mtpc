import { InvalidTenantError, TenantNotFoundError } from '@mtpc/shared';
import type { TenantConfig, TenantContext, TenantInfo } from '../types/index.js';
import { createTenantContext, validateTenantContext } from './context.js';

/**
 * Tenant store interface
 */
export interface TenantStore {
  get(id: string): Promise<TenantInfo | null>;
  list(): Promise<TenantInfo[]>;
  create(info: Omit<TenantInfo, 'createdAt' | 'updatedAt'>): Promise<TenantInfo>;
  update(id: string, info: Partial<TenantInfo>): Promise<TenantInfo>;
  delete(id: string): Promise<void>;
}

/**
 * In-memory tenant store
 */
export class InMemoryTenantStore implements TenantStore {
  private tenants: Map<string, TenantInfo> = new Map();

  async get(id: string): Promise<TenantInfo | null> {
    return this.tenants.get(id) ?? null;
  }

  async list(): Promise<TenantInfo[]> {
    return Array.from(this.tenants.values());
  }

  async create(info: Omit<TenantInfo, 'createdAt' | 'updatedAt'>): Promise<TenantInfo> {
    if (this.tenants.has(info.id)) {
      throw new InvalidTenantError(`Tenant ${info.id} already exists`);
    }

    const now = new Date();
    const tenant: TenantInfo = {
      ...info,
      createdAt: now,
      updatedAt: now,
    };

    this.tenants.set(info.id, tenant);
    return tenant;
  }

  async update(id: string, info: Partial<TenantInfo>): Promise<TenantInfo> {
    const existing = this.tenants.get(id);

    if (!existing) {
      throw new TenantNotFoundError(id);
    }

    const updated: TenantInfo = {
      ...existing,
      ...info,
      id, // ID cannot be changed
      updatedAt: new Date(),
    };

    this.tenants.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.tenants.has(id)) {
      throw new TenantNotFoundError(id);
    }

    this.tenants.delete(id);
  }

  clear(): void {
    this.tenants.clear();
  }
}

/**
 * Tenant manager
 */
export class TenantManager {
  private store: TenantStore;
  private cache: Map<string, { tenant: TenantInfo; expiresAt: number }> = new Map();
  private cacheTtl: number;

  constructor(store: TenantStore, options?: { cacheTtl?: number }) {
    this.store = store;
    this.cacheTtl = options?.cacheTtl ?? 60000; // 1 minute default
  }

  /**
   * Get tenant by ID
   */
  async getTenant(id: string): Promise<TenantInfo | null> {
    // Check cache
    const cached = this.cache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant;
    }

    // Fetch from store
    const tenant = await this.store.get(id);

    if (tenant) {
      this.cache.set(id, {
        tenant,
        expiresAt: Date.now() + this.cacheTtl,
      });
    }

    return tenant;
  }

  /**
   * Get tenant or throw
   */
  async getTenantOrThrow(id: string): Promise<TenantInfo> {
    const tenant = await this.getTenant(id);

    if (!tenant) {
      throw new TenantNotFoundError(id);
    }

    return tenant;
  }

  /**
   * Create tenant context from ID
   */
  async createContext(id: string): Promise<TenantContext> {
    const tenant = await this.getTenantOrThrow(id);
    return createTenantContext(tenant.id, {
      status: tenant.status,
      metadata: tenant.metadata,
    });
  }

  /**
   * Validate and get tenant context
   */
  async validateAndGetContext(id: string): Promise<TenantContext> {
    const context = await this.createContext(id);
    validateTenantContext(context);
    return context;
  }

  /**
   * List all tenants
   */
  async listTenants(): Promise<TenantInfo[]> {
    return this.store.list();
  }

  /**
   * Create tenant
   */
  async createTenant(info: Omit<TenantInfo, 'createdAt' | 'updatedAt'>): Promise<TenantInfo> {
    const tenant = await this.store.create(info);
    this.invalidateCache(tenant.id);
    return tenant;
  }

  /**
   * Update tenant
   */
  async updateTenant(id: string, info: Partial<TenantInfo>): Promise<TenantInfo> {
    const tenant = await this.store.update(id, info);
    this.invalidateCache(id);
    return tenant;
  }

  /**
   * Delete tenant
   */
  async deleteTenant(id: string): Promise<void> {
    await this.store.delete(id);
    this.invalidateCache(id);
  }

  /**
   * Invalidate cache for tenant
   */
  invalidateCache(id: string): void {
    this.cache.delete(id);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Create a tenant manager with in-memory store
 */
export function createTenantManager(options?: { cacheTtl?: number }): TenantManager {
  return new TenantManager(new InMemoryTenantStore(), options);
}
