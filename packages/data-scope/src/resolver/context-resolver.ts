import type { MTPCContext } from '@mtpc/core';
import { getByPath } from '@mtpc/shared';

/**
 * Resolve a value from context by path
 */
export function resolveFromContext(ctx: MTPCContext, path: string): unknown {
  return getByPath(ctx as unknown as Record<string, unknown>, path);
}

/**
 * Create a resolver function for a context path
 */
export function createContextResolver(path: string): (ctx: MTPCContext) => unknown {
  return ctx => resolveFromContext(ctx, path);
}

/**
 * Common context resolvers
 */
export const contextResolvers = {
  /**
   * Get subject ID
   */
  subjectId: (ctx: MTPCContext): string => ctx.subject.id,

  /**
   * Get tenant ID
   */
  tenantId: (ctx: MTPCContext): string => ctx.tenant.id,

  /**
   * Get subject type
   */
  subjectType: (ctx: MTPCContext): string => ctx.subject.type,

  /**
   * Get subject roles
   */
  roles: (ctx: MTPCContext): string[] => ctx.subject.roles ?? [],

  /**
   * Get subject permissions
   */
  permissions: (ctx: MTPCContext): string[] => ctx.subject.permissions ?? [],

  /**
   * Get department ID from metadata
   */
  departmentId: (ctx: MTPCContext): unknown => ctx.subject.metadata?.departmentId,

  /**
   * Get team ID from metadata
   */
  teamId: (ctx: MTPCContext): unknown => ctx.subject.metadata?.teamId,

  /**
   * Get organization ID from metadata
   */
  organizationId: (ctx: MTPCContext): unknown => ctx.subject.metadata?.organizationId,

  /**
   * Check if subject is admin
   */
  isAdmin: (ctx: MTPCContext): boolean => ctx.subject.roles?.includes('admin') ?? false,

  /**
   * Check if subject is system
   */
  isSystem: (ctx: MTPCContext): boolean => ctx.subject.type === 'system',
};

/**
 * Create a metadata resolver
 */
export function createMetadataResolver(key: string): (ctx: MTPCContext) => unknown {
  return ctx => ctx.subject.metadata?.[key];
}

/**
 * Create a role checker
 */
export function createRoleChecker(role: string): (ctx: MTPCContext) => boolean {
  return ctx => ctx.subject.roles?.includes(role) ?? false;
}

/**
 * Create a multi-role checker (any)
 */
export function createAnyRoleChecker(roles: string[]): (ctx: MTPCContext) => boolean {
  return ctx => roles.some(role => ctx.subject.roles?.includes(role));
}

/**
 * Create a multi-role checker (all)
 */
export function createAllRolesChecker(roles: string[]): (ctx: MTPCContext) => boolean {
  return ctx => roles.every(role => ctx.subject.roles?.includes(role));
}
