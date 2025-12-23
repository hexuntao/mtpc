import type { GlobalHooksManager } from '../hooks/global.js';
import type { UnifiedRegistry } from '../registry/unified-registry.js';
import type {
  GlobalHooks,
  PluginContext,
  PolicyDefinition,
  ResourceDefinition,
  ResourceHooks,
} from '../types/index.js';

/**
 * Create plugin context
 */
export function createPluginContext(
  registry: UnifiedRegistry,
  globalHooks: GlobalHooksManager
): PluginContext {
  return {
    registerResource(resource: ResourceDefinition): void {
      registry.registerResource(resource);
    },

    registerPolicy(policy: PolicyDefinition): void {
      registry.registerPolicy(policy);
    },

    registerGlobalHooks(hooks: Partial<GlobalHooks>): void {
      if (hooks.beforeAny) {
        for (const hook of hooks.beforeAny) {
          globalHooks.addBeforeAny(hook);
        }
      }
      if (hooks.afterAny) {
        for (const hook of hooks.afterAny) {
          globalHooks.addAfterAny(hook);
        }
      }
      if (hooks.onError) {
        for (const hook of hooks.onError) {
          globalHooks.addOnError(hook);
        }
      }
    },

    extendResourceHooks<T>(resourceName: string, hooks: Partial<ResourceHooks<T>>): void {
      const resource = registry.resources.get(resourceName);

      if (!resource) {
        throw new Error(`Resource not found: ${resourceName}`);
      }

      // Merge hooks
      const existingHooks = resource.hooks;
      const mergedHooks = {
        beforeCreate: [...(existingHooks.beforeCreate ?? []), ...(hooks.beforeCreate ?? [])],
        afterCreate: [...(existingHooks.afterCreate ?? []), ...(hooks.afterCreate ?? [])],
        beforeRead: [...(existingHooks.beforeRead ?? []), ...(hooks.beforeRead ?? [])],
        afterRead: [...(existingHooks.afterRead ?? []), ...(hooks.afterRead ?? [])],
        beforeUpdate: [...(existingHooks.beforeUpdate ?? []), ...(hooks.beforeUpdate ?? [])],
        afterUpdate: [...(existingHooks.afterUpdate ?? []), ...(hooks.afterUpdate ?? [])],
        beforeDelete: [...(existingHooks.beforeDelete ?? []), ...(hooks.beforeDelete ?? [])],
        afterDelete: [...(existingHooks.afterDelete ?? []), ...(hooks.afterDelete ?? [])],
        beforeList: [...(existingHooks.beforeList ?? []), ...(hooks.beforeList ?? [])],
        afterList: [...(existingHooks.afterList ?? []), ...(hooks.afterList ?? [])],
        filterQuery: [...(existingHooks.filterQuery ?? []), ...(hooks.filterQuery ?? [])],
      };

      // Update resource (note: this is a bit hacky, in production you'd want immutable updates)
      (resource as any).hooks = mergedHooks;
    },

    getResource(name: string): ResourceDefinition | undefined {
      return registry.resources.get(name);
    },

    getPolicy(id: string): PolicyDefinition | undefined {
      return registry.policies.get(id);
    },
  };
}
