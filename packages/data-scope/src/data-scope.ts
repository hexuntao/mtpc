import type { FilterCondition, MTPC, MTPCContext, ResourceDefinition } from '@mtpc/core';
import { setHierarchyResolver } from './filter/generator.js';
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
 * DataScope - MTPC 的行级安全控制
 */
export class DataScope {
  private registry: ScopeRegistry;
  private resolver: ScopeResolver;

  constructor(options: DataScopeOptions = {}) {
    const store = options.store ?? new InMemoryDataScopeStore();

    this.registry = createScopeRegistry(store, {
      cacheTTL: options.cacheTTL,
    });

    // 设置层级解析器
    if (options.hierarchyResolver) {
      setHierarchyResolver(options.hierarchyResolver);
    }

    this.resolver = createScopeResolver(this.registry, {
      defaultScopeId: options.defaultScope ? `scope:${options.defaultScope}` : undefined,
      adminRoles: options.adminRoles ?? ['admin'],
      checkWildcardPermission: options.checkWildcardPermission ?? true,
    });
  }

  /**
   * 定义新范围
   */
  async defineScope(definition: Omit<DataScopeDefinition, 'id'>): Promise<DataScopeDefinition> {
    return this.registry.createScope(definition);
  }

  /**
   * 根据 ID 获取范围
   */
  async getScope(id: string): Promise<DataScopeDefinition | null> {
    return this.registry.getScope(id);
  }

  /**
   * 将范围分配给资源
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
   * 将范围分配给角色
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
   * 将范围分配给主体
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
   * 解析上下文的范围
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
   * 获取上下文和资源的过滤器
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
   * 检查主体是否有无限制访问权限
   */
  async hasUnrestrictedAccess(ctx: MTPCContext): Promise<boolean> {
    return this.resolver.hasUnrestrictedAccess(ctx);
  }

  /**
   * 为资源创建 filterQuery 钩子
   */
  createFilterQueryHook(resourceName: string) {
    return async (ctx: MTPCContext, baseFilters: FilterCondition[]): Promise<FilterCondition[]> => {
      return this.getFilters(ctx, resourceName, baseFilters);
    };
  }

  /**
   * 安全地扩展资源钩子
   *
   * @internal 这是内部方法，用于在集成时扩展资源钩子
   * @param resource 资源定义
   * @param hook 要添加的钩子函数
   *
   * @warning 此方法直接修改 resource.hooks，这是有意为之的行为
   * 因为 ResourceDefinition 的 hooks 属性是只读的，我们需要使用类型断言
   *
   * @example
   * ```typescript
   * const hook = async (ctx, filters) => [...filters, { field: 'tenantId', operator: 'eq', value: ctx.tenant.id }];
   * this.extendResourceHooks(resource, 'filterQuery', hook);
   * ```
   */
  private extendResourceHooks(
    resource: ResourceDefinition,
    hookName: 'filterQuery',
    hook: (ctx: MTPCContext, filters: FilterCondition[]) => Promise<FilterCondition[]>
  ): void {
    const existingHooks = resource.hooks[hookName] ?? [];
    // 类型断言：我们需要扩展只读的 hooks 属性
    (resource.hooks as { filterQuery: typeof existingHooks }).filterQuery = [
      ...existingHooks,
      hook,
    ];
  }

  /**
   * 与 MTPC 集成
   *
   * 为所有已注册的资源添加 filterQuery 钩子
   *
   * @param mtpc MTPC 实例
   *
   * @example
   * ```typescript
   * const mtpc = createMTPC();
   * const dataScope = createDataScope();
   *
   * // 注册资源...
   * mtpc.registry.registerResource(userResource);
   *
   * // 集成 data-scope
   * dataScope.integrateWith(mtpc);
   * ```
   */
  integrateWith(mtpc: MTPC): void {
    // 为所有资源添加 filterQuery 钩子
    for (const resource of mtpc.registry.resources.list()) {
      const hook = this.createFilterQueryHook(resource.name);
      this.extendResourceHooks(resource, 'filterQuery', hook);
    }
  }

  /**
   * 快速设置：将预定义范围分配给角色
   */
  async setupDefaultScopes(tenantId: string, roleScopes: Record<string, ScopeType>): Promise<void> {
    for (const [role, scopeType] of Object.entries(roleScopes)) {
      const scopeId = `scope:${scopeType}`;
      await this.assignToRole(tenantId, role, scopeId);
    }
  }

  /**
   * 获取注册表
   */
  getRegistry(): ScopeRegistry {
    return this.registry;
  }

  /**
   * 获取解析器
   */
  getResolver(): ScopeResolver {
    return this.resolver;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.registry.clearCache();
  }
}

/**
 * 创建 DataScope 实例
 */
export function createDataScope(options?: DataScopeOptions): DataScope {
  return new DataScope(options);
}

// 便捷重导出构建器
export { scope, createScope, PREDEFINED_SCOPES };
