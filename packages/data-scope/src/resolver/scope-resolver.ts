import type { FilterCondition, MTPCContext } from '@mtpc/core';
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
import { contextResolvers } from './context-resolver.js';

/**
 * Scope resolver - determines which scopes apply to a request
 */
export class ScopeResolver {
  private registry: ScopeRegistry;
  private defaultScopeId: string;

  constructor(registry: ScopeRegistry, options: { defaultScopeId?: string } = {}) {
    this.registry = registry;
    this.defaultScopeId = options.defaultScopeId ?? 'scope:tenant';
  }

  /**
   * Resolve scopes for a request
   */
  async resolve(context: ScopeResolutionContext): Promise<ScopeResolutionResult> {
    const { mtpcContext, resourceName } = context;
    const startTime = Date.now();

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
    if (contextResolvers.isAdmin(mtpcContext)) {
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
   * Quick check if subject has unrestricted access
   */
  async hasUnrestrictedAccess(ctx: MTPCContext): Promise<boolean> {
    if (contextResolvers.isSystem(ctx)) {
      return true;
    }

    if (contextResolvers.isAdmin(ctx)) {
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
   * Get effective scope type for subject
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
 * Create scope resolver
 */
export function createScopeResolver(
  registry: ScopeRegistry,
  options?: { defaultScopeId?: string }
): ScopeResolver {
  return new ScopeResolver(registry, options);
}
