import type {
  PermissionCheckResult,
  PolicyDefinition,
  ResourceDefinition,
  SubjectContext,
  TenantContext,
} from '@mtpc/core';
import { createPermissionCode, parsePermissionCode } from '@mtpc/shared';
import type { MockMTPC, MockMTPCOptions, PermissionCheckSpy } from '../types.js';

/**
 * Create a mock MTPC instance for testing
 */
export function createMockMTPC(options: MockMTPCOptions = {}): MockMTPC {
  const { resources = [], policies = [], defaultPermissions = [], defaultDeny = true } = options;

  // Permission grants: tenantId -> subjectId -> Set<permission>
  const grants = new Map<string, Map<string, Set<string>>>();

  // Spy data
  const spyCalls: PermissionCheckSpy['calls'] = [];

  // Helper to get or create tenant map
  const getTenantGrants = (tenantId: string): Map<string, Set<string>> => {
    let tenantMap = grants.get(tenantId);
    if (!tenantMap) {
      tenantMap = new Map();
      grants.set(tenantId, tenantMap);
    }
    return tenantMap;
  };

  // Helper to get or create subject set
  const getSubjectPermissions = (tenantId: string, subjectId: string): Set<string> => {
    const tenantMap = getTenantGrants(tenantId);
    let perms = tenantMap.get(subjectId);
    if (!perms) {
      perms = new Set(defaultPermissions);
      tenantMap.set(subjectId, perms);
    }
    return perms;
  };

  const mockMTPC: MockMTPC = {
    grantPermission(permission: string, subjectId = '*', tenantId = '*'): void {
      getSubjectPermissions(tenantId, subjectId).add(permission);
    },

    grantPermissions(permissions: string[], subjectId = '*', tenantId = '*'): void {
      const perms = getSubjectPermissions(tenantId, subjectId);
      for (const p of permissions) {
        perms.add(p);
      }
    },

    revokePermission(permission: string, subjectId = '*', tenantId = '*'): void {
      const tenantMap = grants.get(tenantId);
      if (tenantMap) {
        const perms = tenantMap.get(subjectId);
        if (perms) {
          perms.delete(permission);
        }
      }
    },

    revokeAllPermissions(subjectId = '*', tenantId = '*'): void {
      const tenantMap = grants.get(tenantId);
      if (tenantMap) {
        tenantMap.delete(subjectId);
      }
    },

    setPermissions(permissions: string[], subjectId = '*', tenantId = '*'): void {
      const tenantMap = getTenantGrants(tenantId);
      tenantMap.set(subjectId, new Set(permissions));
    },

    async checkPermission(context: {
      tenant: TenantContext;
      subject: SubjectContext;
      resource: string;
      action: string;
    }): Promise<PermissionCheckResult> {
      const { tenant, subject, resource, action } = context;
      const permission = createPermissionCode(resource, action);
      const startTime = Date.now();

      // Check system subject
      if (subject.type === 'system' || subject.permissions?.includes('*')) {
        const result: PermissionCheckResult = {
          allowed: true,
          permission,
          reason: 'System access',
          evaluationTime: Date.now() - startTime,
        };
        spyCalls.push({
          context: {
            tenantId: tenant.id,
            subjectId: subject.id,
            resource,
            action,
          },
          result,
          timestamp: new Date(),
        });
        return result;
      }

      // Check direct subject permissions
      if (subject.permissions?.includes(permission)) {
        const result: PermissionCheckResult = {
          allowed: true,
          permission,
          reason: 'Direct permission',
          evaluationTime: Date.now() - startTime,
        };
        spyCalls.push({
          context: {
            tenantId: tenant.id,
            subjectId: subject.id,
            resource,
            action,
          },
          result,
          timestamp: new Date(),
        });
        return result;
      }

      // Check grants
      const checkGrant = (tId: string, sId: string): boolean => {
        const tenantMap = grants.get(tId);
        if (!tenantMap) return false;
        const perms = tenantMap.get(sId);
        if (!perms) return false;

        // Check wildcard
        if (perms.has('*')) return true;
        // Check resource wildcard
        if (perms.has(`${resource}:*`)) return true;
        // Check exact
        return perms.has(permission);
      };

      const allowed =
        checkGrant(tenant.id, subject.id) ||
        checkGrant(tenant.id, '*') ||
        checkGrant('*', subject.id) ||
        checkGrant('*', '*');

      const result: PermissionCheckResult = {
        allowed,
        permission,
        reason: allowed ? 'Permission granted' : defaultDeny ? 'Default deny' : 'No matching grant',
        evaluationTime: Date.now() - startTime,
      };

      spyCalls.push({
        context: {
          tenantId: tenant.id,
          subjectId: subject.id,
          resource,
          action,
        },
        result,
        timestamp: new Date(),
      });

      return result;
    },

    getSpy(): PermissionCheckSpy {
      return {
        calls: spyCalls,
        reset(): void {
          spyCalls.length = 0;
        },
        getCallsFor(permission: string) {
          return spyCalls.filter(
            c => createPermissionCode(c.context.resource, c.context.action) === permission
          );
        },
        wasChecked(permission: string): boolean {
          return spyCalls.some(
            c => createPermissionCode(c.context.resource, c.context.action) === permission
          );
        },
        wasAllowed(permission: string): boolean {
          return spyCalls.some(
            c =>
              createPermissionCode(c.context.resource, c.context.action) === permission &&
              c.result.allowed
          );
        },
        wasDenied(permission: string): boolean {
          return spyCalls.some(
            c =>
              createPermissionCode(c.context.resource, c.context.action) === permission &&
              !c.result.allowed
          );
        },
      };
    },

    reset(): void {
      grants.clear();
      spyCalls.length = 0;
    },

    getResource(name: string): ResourceDefinition | undefined {
      return resources.find(r => r.name === name);
    },

    getPermissions(): string[] {
      const perms: string[] = [];
      for (const resource of resources) {
        for (const p of resource.permissions) {
          perms.push(createPermissionCode(resource.name, p.action));
        }
      }
      return perms;
    },

    getGrantedPermissions(subjectId: string, tenantId = '*'): string[] {
      const perms: string[] = [];

      // Collect from specific tenant
      const tenantMap = grants.get(tenantId);
      if (tenantMap) {
        const subjectPerms = tenantMap.get(subjectId);
        if (subjectPerms) {
          perms.push(...subjectPerms);
        }
        // Also check wildcard subject
        const wildcardPerms = tenantMap.get('*');
        if (wildcardPerms) {
          perms.push(...wildcardPerms);
        }
      }

      // Collect from wildcard tenant
      const wildcardTenantMap = grants.get('*');
      if (wildcardTenantMap) {
        const subjectPerms = wildcardTenantMap.get(subjectId);
        if (subjectPerms) {
          perms.push(...subjectPerms);
        }
        const wildcardPerms = wildcardTenantMap.get('*');
        if (wildcardPerms) {
          perms.push(...wildcardPerms);
        }
      }

      return [...new Set(perms)];
    },

    hasPermission(permission: string, subjectId: string, tenantId = '*'): boolean {
      const perms = this.getGrantedPermissions(subjectId, tenantId);
      return perms.includes(permission) || perms.includes('*');
    },
  };

  return mockMTPC;
}

/**
 * Create a mock MTPC that allows everything
 */
export function createPermissiveMockMTPC(): MockMTPC {
  const mock = createMockMTPC({ defaultDeny: false });
  mock.grantPermission('*');
  return mock;
}

/**
 * Create a mock MTPC that denies everything
 */
export function createRestrictiveMockMTPC(): MockMTPC {
  return createMockMTPC({ defaultDeny: true });
}
