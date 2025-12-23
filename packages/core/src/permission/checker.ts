import { createPermissionCode, PermissionDeniedError, parsePermissionCode } from '@mtpc/shared';
import type {
  BatchPermissionCheckResult,
  Permission,
  PermissionCheckContext,
  PermissionCheckResult,
  PermissionSet,
} from '../types/index.js';

/**
 * Permission checker class
 */
export class PermissionChecker {
  private permissionResolver: (tenantId: string, subjectId: string) => Promise<Set<string>>;

  constructor(resolver: (tenantId: string, subjectId: string) => Promise<Set<string>>) {
    this.permissionResolver = resolver;
  }

  /**
   * Check single permission
   */
  async check(context: PermissionCheckContext): Promise<PermissionCheckResult> {
    const startTime = Date.now();
    const permissionCode = createPermissionCode(context.resource, context.action);

    // System subject always allowed
    if (context.subject.type === 'system') {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'System subject has full access',
        evaluationTime: Date.now() - startTime,
      };
    }

    // Check direct permissions on subject
    if (
      context.subject.permissions?.includes(permissionCode) ||
      context.subject.permissions?.includes('*')
    ) {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'Direct permission on subject',
        evaluationTime: Date.now() - startTime,
      };
    }

    // Resolve permissions from external source
    const permissions = await this.permissionResolver(context.tenant.id, context.subject.id);

    // Check wildcard
    if (permissions.has('*')) {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'Wildcard permission',
        evaluationTime: Date.now() - startTime,
      };
    }

    // Check resource wildcard
    const resourceWildcard = `${context.resource}:*`;
    if (permissions.has(resourceWildcard)) {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'Resource wildcard permission',
        evaluationTime: Date.now() - startTime,
      };
    }

    // Check specific permission
    if (permissions.has(permissionCode)) {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'Specific permission granted',
        evaluationTime: Date.now() - startTime,
      };
    }

    // Default deny
    return {
      allowed: false,
      permission: permissionCode,
      reason: 'Permission not granted',
      evaluationTime: Date.now() - startTime,
    };
  }

  /**
   * Check permission and throw if denied
   */
  async checkOrThrow(context: PermissionCheckContext): Promise<void> {
    const result = await this.check(context);

    if (!result.allowed) {
      throw new PermissionDeniedError(result.permission, {
        reason: result.reason,
        tenantId: context.tenant.id,
        subjectId: context.subject.id,
      });
    }
  }

  /**
   * Check multiple permissions
   */
  async checkMany(contexts: PermissionCheckContext[]): Promise<BatchPermissionCheckResult> {
    const results = new Map<string, PermissionCheckResult>();

    for (const context of contexts) {
      const code = createPermissionCode(context.resource, context.action);
      const result = await this.check(context);
      results.set(code, result);
    }

    const allAllowed = Array.from(results.values()).every(r => r.allowed);
    const anyAllowed = Array.from(results.values()).some(r => r.allowed);

    return { results, allAllowed, anyAllowed };
  }

  /**
   * Check if subject has any of the permissions
   */
  async hasAny(
    context: Omit<PermissionCheckContext, 'resource' | 'action'>,
    permissions: string[]
  ): Promise<boolean> {
    for (const permission of permissions) {
      const parsed = parsePermissionCode(permission);
      if (!parsed) continue;

      const result = await this.check({
        ...context,
        resource: parsed.resource,
        action: parsed.action,
      });

      if (result.allowed) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if subject has all of the permissions
   */
  async hasAll(
    context: Omit<PermissionCheckContext, 'resource' | 'action'>,
    permissions: string[]
  ): Promise<boolean> {
    for (const permission of permissions) {
      const parsed = parsePermissionCode(permission);
      if (!parsed) return false;

      const result = await this.check({
        ...context,
        resource: parsed.resource,
        action: parsed.action,
      });

      if (!result.allowed) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Create a simple permission checker with static permissions
 */
export function createSimpleChecker(
  getPermissions: (tenantId: string, subjectId: string) => Set<string> | Promise<Set<string>>
): PermissionChecker {
  return new PermissionChecker(async (tenantId, subjectId) => {
    const result = getPermissions(tenantId, subjectId);
    return result instanceof Promise ? result : result;
  });
}

/**
 * Create a permission checker that always allows
 */
export function createAllowAllChecker(): PermissionChecker {
  return new PermissionChecker(async () => new Set(['*']));
}

/**
 * Create a permission checker that always denies
 */
export function createDenyAllChecker(): PermissionChecker {
  return new PermissionChecker(async () => new Set());
}
