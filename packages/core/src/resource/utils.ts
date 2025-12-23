import type { ResourceDefinition, ResourceFeatures } from '../types/index.js';

/**
 * Check if resource has feature enabled
 */
export function hasFeature(
  resource: ResourceDefinition,
  feature: keyof ResourceFeatures | keyof ResourceFeatures['advanced']
): boolean {
  if (feature in resource.features) {
    return resource.features[feature as keyof ResourceFeatures] as boolean;
  }

  if (feature in resource.features.advanced) {
    return resource.features.advanced[feature as keyof ResourceFeatures['advanced']];
  }

  return false;
}

/**
 * Get all permission codes for a resource
 */
export function getResourcePermissionCodes(resource: ResourceDefinition): string[] {
  return resource.permissions.map(p => `${resource.name}:${p.action}`);
}

/**
 * Get resource actions
 */
export function getResourceActions(resource: ResourceDefinition): string[] {
  return resource.permissions.map(p => p.action);
}

/**
 * Check if resource supports action
 */
export function supportsAction(resource: ResourceDefinition, action: string): boolean {
  return resource.permissions.some(p => p.action === action);
}

/**
 * Get resource field names from schema
 */
export function getResourceFields(resource: ResourceDefinition): string[] {
  const schema = resource.schema;

  if (schema._def.typeName === 'ZodObject') {
    return Object.keys((schema as any).shape);
  }

  return [];
}

/**
 * Merge resource definitions
 */
export function extendResource<T extends ResourceDefinition>(
  base: T,
  extension: Partial<Omit<T, 'name' | 'schema'>>
): T {
  return {
    ...base,
    features: {
      ...base.features,
      ...extension.features,
      advanced: {
        ...base.features.advanced,
        ...extension.features?.advanced,
      },
    },
    permissions: [...base.permissions, ...(extension.permissions ?? [])],
    hooks: mergeHooks(base.hooks, extension.hooks ?? {}),
    relations: [...base.relations, ...(extension.relations ?? [])],
    metadata: {
      ...base.metadata,
      ...extension.metadata,
      tags: [...(base.metadata.tags ?? []), ...(extension.metadata?.tags ?? [])],
    },
  } as T;
}

/**
 * Merge hooks
 */
function mergeHooks(
  base: ResourceDefinition['hooks'],
  extension: Partial<ResourceDefinition['hooks']>
): ResourceDefinition['hooks'] {
  return {
    beforeCreate: [...(base.beforeCreate ?? []), ...(extension.beforeCreate ?? [])],
    afterCreate: [...(base.afterCreate ?? []), ...(extension.afterCreate ?? [])],
    beforeRead: [...(base.beforeRead ?? []), ...(extension.beforeRead ?? [])],
    afterRead: [...(base.afterRead ?? []), ...(extension.afterRead ?? [])],
    beforeUpdate: [...(base.beforeUpdate ?? []), ...(extension.beforeUpdate ?? [])],
    afterUpdate: [...(base.afterUpdate ?? []), ...(extension.afterUpdate ?? [])],
    beforeDelete: [...(base.beforeDelete ?? []), ...(extension.beforeDelete ?? [])],
    afterDelete: [...(base.afterDelete ?? []), ...(extension.afterDelete ?? [])],
    beforeList: [...(base.beforeList ?? []), ...(extension.beforeList ?? [])],
    afterList: [...(base.afterList ?? []), ...(extension.afterList ?? [])],
    filterQuery: [...(base.filterQuery ?? []), ...(extension.filterQuery ?? [])],
  };
}
