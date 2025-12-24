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

    // 系统主体无需范围检查
    if (contextResolvers.isSystem(mtpcContext)) {
      return {
        scopes: [],
        combinedFilters: context.existingFilters ?? [],
        appliedScopeIds: [],
        resolvedAt: new Date(),
      };
    }

    // 检查管理员权限 - 使用 "all" 范围
    if (this.isAdminChecker(mtpcContext)) {
      const allScope = PREDEFINED_SCOPES.all;
      return {
        scopes: [{ definition: allScope, filters: [], resolvedAt: new Date() }],
        combinedFilters: context.existingFilters ?? [],
        appliedScopeIds: [allScope.id],
        resolvedAt: new Date(),
      };
    }

    // 收集适用范围
    const scopes: DataScopeDefinition[] = [];

    // 1. 检查资源特定范围
    const resourceScope = await this.registry.getScopeForResource(
      mtpcContext.tenant.id,
      resourceName
    );
    if (resourceScope) {
      scopes.push(resourceScope);
    }

    // 2. 检查主体/角色范围
    const subjectScopes = await this.registry.getScopesForSubject(
      mtpcContext.tenant.id,
      mtpcContext.subject.id,
      mtpcContext.subject.roles ?? []
    );
    scopes.push(...subjectScopes);

    // 3. 应用默认范围（如果没有其他范围）
    if (scopes.length === 0) {
      const defaultScope = await this.registry.getScope(this.defaultScopeId);
      if (defaultScope) {
        scopes.push(defaultScope);
      }
    }

    // 4. 解析范围到过滤条件
    const resolvedScopes: ResolvedScope[] = [];
    for (const scope of scopes) {
      const resolved = await resolveScope(scope, mtpcContext);
      resolvedScopes.push(resolved);
    }

    // 合并过滤条件
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

    // 检查 "all" 范围是否分配给主体
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

    // 返回最高优先级范围类型
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
