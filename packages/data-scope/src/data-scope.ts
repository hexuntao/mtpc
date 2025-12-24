import type { FilterCondition, MTPC, MTPCContext, ResourceDefinition } from '@mtpc/core';
import { createScopeResolver, type ScopeResolver } from './resolver/scope-resolver.js';
import { createScope, scope } from './scope/builder.js';
import { PREDEFINED_SCOPES } from './scope/predefined.js';
import {
  createScopeRegistry,
  InMemoryDataScopeStore,
  type ScopeRegistry,
} from './scope/registry.js';
import type {
  DataScopeDefinition,
  DataScopeOptions,
  ScopeAssignment,
  ScopeResolutionResult,
  ScopeType,
} from './types.js';

/**
 * DataScope - Row-level security for MTPC
 */
export class DataScope {
  private registry: ScopeRegistry;
  private resolver: ScopeResolver;
  private options: DataScopeOptions;

  constructor(options: DataScopeOptions = {}) {
    this.options = options;
    const store = options.store ?? new InMemoryDataScopeStore();

    this.registry = createScopeRegistry(store, {
      cacheTTL: options.cacheTTL,
    });

    this.resolver = createScopeResolver(this.registry, {
      defaultScopeId: options.defaultScope ? `scope:${options.defaultScope}` : undefined,
    });
  }

  /**
   * Define a new scope
   */
  async defineScope(definition: Omit<DataScopeDefinition, 'id'>): Promise<DataScopeDefinition> {
    return this.registry.createScope(definition);
  }

  /**
   * Get a scope by ID
   */
  async getScope(id: string): Promise<DataScopeDefinition | null> {
    return this.registry.getScope(id);
  }

  /**
   * Assign scope to a resource
   */
  async assignToResource(
    tenantId: string,
    resourceName: string,
    scopeId: string,
    options?: { priority?: number }
  ): Promise<ScopeAssignment> {
    return this.registry.assignScope(tenantId, scopeId, 'resource', resourceName, options);
  }

  /**
   * Assign scope to a role
   */
  async assignToRole(
    tenantId: string,
    roleName: string,
    scopeId: string,
    options?: { priority?: number }
  ): Promise<ScopeAssignment> {
    return this.registry.assignScope(tenantId, scopeId, 'role', roleName, options);
  }

  /**
   * Assign scope to a subject
   */
  async assignToSubject(
    tenantId: string,
    subjectId: string,
    scopeId: string,
    options?: { priority?: number }
  ): Promise<ScopeAssignment> {
    return this.registry.assignScope(tenantId, scopeId, 'subject', subjectId, options);
  }

  /**
   * Resolve scopes for a context
   */
  async resolve(
    ctx: MTPCContext,
    resourceName: string,
    action: string = 'read',
    existingFilters?: FilterCondition[]
  ): Promise<ScopeResolutionResult> {
    return this.resolver.resolve({
      mtpcContext: ctx,
      resourceName,
      action,
      existingFilters,
    });
  }

  /**
   * Get filters for a context and resource
   */
  async getFilters(
    ctx: MTPCContext,
    resourceName: string,
    existingFilters?: FilterCondition[]
  ): Promise<FilterCondition[]> {
    const result = await this.resolve(ctx, resourceName, 'read', existingFilters);
    return result.combinedFilters;
  }

  /**
   * Check if subject has unrestricted access
   */
  async hasUnrestrictedAccess(ctx: MTPCContext): Promise<boolean> {
    return this.resolver.hasUnrestrictedAccess(ctx);
  }

  /**
   * Create filterQuery hook for a resource
   */
  createFilterQueryHook(resourceName: string) {
    return async (ctx: MTPCContext, baseFilters: FilterCondition[]): Promise<FilterCondition[]> => {
      return this.getFilters(ctx, resourceName, baseFilters);
    };
  }

  /**
   * Integrate with MTPC
   */
  integrateWith(mtpc: MTPC): void {
    // Add filterQuery hooks to all resources
    for (const resource of mtpc.registry.resources.list()) {
      const hook = this.createFilterQueryHook(resource.name);

      // Extend resource hooks
      const existingHooks = resource.hooks.filterQuery ?? [];
      (resource.hooks as { filterQuery: typeof existingHooks }).filterQuery = [
        ...existingHooks,
        hook,
      ];
    }
  }

  /**
   * Quick setup: assign predefined scopes to roles
   */
  async setupDefaultScopes(tenantId: string, roleScopes: Record<string, ScopeType>): Promise<void> {
    for (const [role, scopeType] of Object.entries(roleScopes)) {
      const scopeId = `scope:${scopeType}`;
      await this.assignToRole(tenantId, role, scopeId);
    }
  }

  /**
   * Get registry
   */
  getRegistry(): ScopeRegistry {
    return this.registry;
  }

  /**
   * Get resolver
   */
  getResolver(): ScopeResolver {
    return this.resolver;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.registry.clearCache();
  }
}

/**
 * Create DataScope instance
 */
export function createDataScope(options?: DataScopeOptions): DataScope {
  return new DataScope(options);
}

// Re-export builders for convenience
export { scope, createScope, PREDEFINED_SCOPES };
