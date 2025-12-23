import type { PluginContext, PluginDefinition } from '@mtpc/core';
import { BindingManager } from './binding/manager.js';
import { RBACEvaluator } from './policy/evaluator.js';
import { systemRoles } from './role/builder.js';
import { RoleManager } from './role/manager.js';
import { InMemoryRBACStore } from './store/memory-store.js';
import type { RBACOptions, RBACStore } from './types.js';

/**
 * RBAC plugin state
 */
export interface RBACPluginState {
  store: RBACStore;
  roles: RoleManager;
  bindings: BindingManager;
  evaluator: RBACEvaluator;
}

/**
 * Create RBAC plugin
 */
export function createRBACPlugin(
  options: RBACOptions = {}
): PluginDefinition & { state: RBACPluginState } {
  const store = options.store ?? new InMemoryRBACStore();
  const roles = new RoleManager(store);
  const bindings = new BindingManager(store);
  const evaluator = new RBACEvaluator(store, {
    cacheTTL: options.cacheTTL,
  });

  // Register system roles
  const defaultSystemRoles = options.systemRoles ?? [
    systemRoles.superAdmin().buildDefinition('super_admin'),
    systemRoles.tenantAdmin().buildDefinition('tenant_admin'),
    systemRoles.viewer().buildDefinition('viewer'),
  ];

  for (const role of defaultSystemRoles) {
    roles.registerSystemRole(role);
  }

  const state: RBACPluginState = {
    store,
    roles,
    bindings,
    evaluator,
  };

  return {
    name: '@mtpc/rbac',
    version: '0.1.0',
    description: 'Role-Based Access Control extension for MTPC',

    state,

    install(context: PluginContext): void {
      // Register global hooks for permission checking
      context.registerGlobalHooks({
        beforeAny: [
          async (mtpcContext, operation, resourceName) => {
            // This hook can be used to inject RBAC-based permission checking
            // For now, we just return proceed: true
            return { proceed: true };
          },
        ],
      });
    },

    onInit(context: PluginContext): void {
      console.log('RBAC plugin initialized');
    },

    onDestroy(): void {
      evaluator.clearCache();
    },
  };
}
