import type {
  PermissionDefinition,
  Permission,
  ResourceFeatures,
  PermissionScope,
} from '../types/index.js';
import { DEFAULT_ACTIONS, createPermissionCode } from '@mtpc/shared';

/**
 * Generate permissions based on resource features
 */
export function generatePermissions(
  resourceName: string,
  features: ResourceFeatures
): PermissionDefinition[] {
  const permissions: PermissionDefinition[] = [];

  if (features.create) {
    permissions.push({
      action: DEFAULT_ACTIONS.CREATE,
      description: `Create ${resourceName}`,
      scope: 'tenant',
    });
  }

  if (features.read) {
    permissions.push({
      action: DEFAULT_ACTIONS.READ,
      description: `Read ${resourceName}`,
      scope: 'tenant',
    });
  }

  if (features.update) {
    permissions.push({
      action: DEFAULT_ACTIONS.UPDATE,
      description: `Update ${resourceName}`,
      scope: 'tenant',
    });
  }

  if (features.delete) {
    permissions.push({
      action: DEFAULT_ACTIONS.DELETE,
      description: `Delete ${resourceName}`,
      scope: 'tenant',
    });
  }

  if (features.list) {
    permissions.push({
      action: DEFAULT_ACTIONS.LIST,
      description: `List ${resourceName}`,
      scope: 'tenant',
    });
  }

  // Advanced features
  if (features.advanced.export) {
    permissions.push({
      action: 'export',
      description: `Export ${resourceName}`,
      scope: 'tenant',
    });
  }

  if (features.advanced.import) {
    permissions.push({
      action: 'import',
      description: `Import ${resourceName}`,
      scope: 'tenant',
    });
  }

  if (features.advanced.bulk) {
    permissions.push({
      action: 'bulk',
      description: `Bulk operations on ${resourceName}`,
      scope: 'tenant',
    });
  }

  return permissions;
}

/**
 * Compile permission definition to permission
 */
export function compilePermission(
  resourceName: string,
  definition: PermissionDefinition
): Permission {
  return {
    code: createPermissionCode(resourceName, definition.action),
    resource: resourceName,
    action: definition.action,
    scope: definition.scope ?? 'tenant',
    description: definition.description,
    conditions: definition.conditions ?? [],
    metadata: definition.metadata ?? {},
  };
}

/**
 * Compile all permissions for a resource
 */
export function compileResourcePermissions(
  resourceName: string,
  definitions: PermissionDefinition[]
): Permission[] {
  return definitions.map(def => compilePermission(resourceName, def));
}

/**
 * Generate permission code constants
 */
export function generatePermissionCodes<T extends string>(
  resourceName: T,
  actions: string[]
): Record<string, string> {
  const codes: Record<string, string> = {};
  
  for (const action of actions) {
    const key = `${resourceName.toUpperCase()}_${action.toUpperCase()}`;
    codes[key] = createPermissionCode(resourceName, action);
  }
  
  return codes;
}

/**
 * Generate all permission codes from resources
 */
export function generateAllPermissionCodes(
  resources: Array<{ name: string; permissions: PermissionDefinition[] }>
): Record<string, string> {
  const codes: Record<string, string> = {};
  
  for (const resource of resources) {
    const resourceCodes = generatePermissionCodes(
      resource.name,
      resource.permissions.map(p => p.action)
    );
    Object.assign(codes, resourceCodes);
  }
  
  return codes;
}
