import type { MTPCContext } from '@mtpc/core';
import { combineResolvedScopes, mergeWithExisting } from '../filter/combiner.js';
import { resolveScope } from '../filter/generator.js';
import { PREDEFINED_SCOPES } from '../scope/predefined.js';
import type { ScopeRegistry } from '../scope/registry.js';
import type {
  DataScopeDefinition,
  ResolvedScope,
  ScopeResolutionContext,
  ScopeResolutionResult,
} from '../types.js';
import { contextResolvers, createAdminChecker } from './context-resolver.js';

/**
 * 范围解析器 - 确定哪些范围适用于请求
 */
export class ScopeResolver {
  private registry: ScopeRegistry;
  private defaultScopeId: string;
  private isAdminChecker: (ctx: MTPCContext) => boolean;
  private checkWildcardPermission: boolean;

  constructor(
    registry: ScopeRegistry,
    options: {
      defaultScopeId?: string;
      adminRoles?: string[];
      checkWildcardPermission?: boolean;
    } = {}
  ) {
    this.registry = registry;
    this.defaultScopeId = options.defaultScopeId ?? 'scope:tenant';
    this.checkWildcardPermission = options.checkWildcardPermission ?? true;

    // 创建管理员检查器
    this.isAdminChecker = createAdminChecker(
      options.adminRoles ?? ['admin'],
      this.checkWildcardPermission
    );
  }

  /**
   * 解析请求的范围
   */
  async resolve(context: ScopeResolutionContext): Promise<ScopeResolutionResult> {
    const { mtpcContext, resourceName } = context;

    // Check for system subject - no restrictions
    if (contextResolvers.isSystem(mtpcContext)) {
      return {
        scopes: [],
        combinedFilters: context.existingFilters ?? [],
        appliedScopeIds: [],
        resolvedAt: new Date(),
      };
    }

    // Check for admin - use "all" scope
    if (this.isAdminChecker(mtpcContext)) {
      const allScope = PREDEFINED_SCOPES.all;
      return {
        scopes: [{ definition: allScope, filters: [], resolvedAt: new Date() }],
        combinedFilters: context.existingFilters ?? [],
        appliedScopeIds: [allScope.id],
        resolvedAt: new Date(),
      };
    }

    // Collect applicable scopes
    const scopes: DataScopeDefinition[] = [];

    // 1. Check resource-specific scope
    const resourceScope = await this.registry.getScopeForResource(
      mtpcContext.tenant.id,
      resourceName
    );
    if (resourceScope) {
      scopes.push(resourceScope);
    }

    // 2. Check subject/role scopes
    const subjectScopes = await this.registry.getScopesForSubject(
      mtpcContext.tenant.id,
      mtpcContext.subject.id,
      mtpcContext.subject.roles ?? []
    );
    scopes.push(...subjectScopes);

    // 3. Apply default scope if no scopes found
    if (scopes.length === 0) {
      const defaultScope = await this.registry.getScope(this.defaultScopeId);
      if (defaultScope) {
        scopes.push(defaultScope);
      }
    }

    // Resolve all scopes to filters
    const resolvedScopes: ResolvedScope[] = [];
    for (const scope of scopes) {
      const resolved = await resolveScope(scope, mtpcContext);
      resolvedScopes.push(resolved);
    }

    // Combine filters
    const scopeFilters = combineResolvedScopes(resolvedScopes);
    const combinedFilters = mergeWithExisting(context.existingFilters ?? [], scopeFilters);

    return {
      scopes: resolvedScopes,
      combinedFilters,
      appliedScopeIds: resolvedScopes.map(s => s.definition.id),
      resolvedAt: new Date(),
    };
  }

  /**
   * 快速检查主体是否有无限制访问权限
   */
  async hasUnrestrictedAccess(ctx: MTPCContext): Promise<boolean> {
    if (contextResolvers.isSystem(ctx)) {
      return true;
    }

    if (this.isAdminChecker(ctx)) {
      return true;
    }

    // Check for "all" scope assignment
    const scopes = await this.registry.getScopesForSubject(
      ctx.tenant.id,
      ctx.subject.id,
      ctx.subject.roles ?? []
    );

    return scopes.some(s => s.type === 'all');
  }

  /**
   * 获取主体的有效范围类型
   */
  async getEffectiveScopeType(
    ctx: MTPCContext,
    resourceName: string
  ): Promise<DataScopeDefinition['type']> {
    if (await this.hasUnrestrictedAccess(ctx)) {
      return 'all';
    }

    const result = await this.resolve({
      mtpcContext: ctx,
      resourceName,
      action: 'read',
    });

    if (result.scopes.length === 0) {
      return 'tenant';
    }

    // Return highest priority scope type
    return result.scopes[0].definition.type;
  }
}

/**
 * 创建范围解析器
 */
export function createScopeResolver(
  registry: ScopeRegistry,
  options?: {
    defaultScopeId?: string;
    adminRoles?: string[];
    checkWildcardPermission?: boolean;
  }
): ScopeResolver {
  return new ScopeResolver(registry, options);
}
