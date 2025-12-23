import { createGlobalHooksManager, type GlobalHooksManager } from './hooks/global.js';
import { PermissionChecker } from './permission/checker.js';
import { createPluginContext } from './plugin/context.js';
import { DefaultPluginManager } from './plugin/manager.js';
import { DefaultPolicyEngine } from './policy/engine.js';
import { createUnifiedRegistry, type UnifiedRegistry } from './registry/unified-registry.js';
import { createTenantManager, type TenantManager } from './tenant/manager.js';
import { ANONYMOUS_SUBJECT, createContext } from './types/context.js';
import type {
  MTPCContext,
  MultiTenantOptions,
  PermissionCheckContext,
  PermissionCheckResult,
  PluginDefinition,
  PolicyDefinition,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  ResourceDefinition,
  SubjectContext,
  TenantContext,
} from './types/index.js';

/**
 * MTPC configuration options
 */
export interface MTPCOptions {
  multiTenant?: MultiTenantOptions;
  defaultPermissionResolver?: (tenantId: string, subjectId: string) => Promise<Set<string>>;
}

/**
 * MTPC - Multi-Tenant Permission Core
 *
 * Main entry point for the MTPC library.
 * This class coordinates all MTPC subsystems.
 */
export class MTPC {
  readonly registry: UnifiedRegistry;
  readonly policyEngine: DefaultPolicyEngine;
  readonly permissionChecker: PermissionChecker;
  readonly globalHooks: GlobalHooksManager;
  readonly plugins: DefaultPluginManager;
  readonly tenants: TenantManager;

  private options: MTPCOptions;
  private initialized = false;

  constructor(options: MTPCOptions = {}) {
    this.options = options;
    this.registry = createUnifiedRegistry();
    this.policyEngine = new DefaultPolicyEngine();
    this.globalHooks = createGlobalHooksManager();
    this.tenants = createTenantManager();

    // Create plugin manager with context
    const pluginContext = createPluginContext(this.registry, this.globalHooks);
    this.plugins = new DefaultPluginManager(pluginContext);

    // Create permission checker
    this.permissionChecker = new PermissionChecker(
      options.defaultPermissionResolver ?? this.defaultPermissionResolver.bind(this)
    );
  }

  /**
   * Register a resource
   */
  registerResource(resource: ResourceDefinition): this {
    this.registry.registerResource(resource);
    return this;
  }

  /**
   * Register multiple resources
   */
  registerResources(resources: ResourceDefinition[]): this {
    this.registry.registerResources(resources);
    return this;
  }

  /**
   * Register a policy
   */
  registerPolicy(policy: PolicyDefinition): this {
    this.registry.registerPolicy(policy);
    this.policyEngine.addPolicy(policy);
    return this;
  }

  /**
   * Register multiple policies
   */
  registerPolicies(policies: PolicyDefinition[]): this {
    for (const policy of policies) {
      this.registerPolicy(policy);
    }
    return this;
  }

  /**
   * Register a plugin
   */
  use(plugin: PluginDefinition): this {
    this.plugins.register(plugin);
    return this;
  }

  /**
   * Initialize MTPC (install all plugins)
   */
  async init(): Promise<this> {
    if (this.initialized) {
      return this;
    }

    await this.plugins.installAll();
    this.registry.freeze();
    this.initialized = true;

    return this;
  }

  /**
   * Create context for a request
   */
  createContext(tenant: TenantContext, subject?: SubjectContext): MTPCContext {
    return createContext({
      tenant,
      subject: subject ?? ANONYMOUS_SUBJECT,
    });
  }

  /**
   * Check permission
   */
  async checkPermission(context: PermissionCheckContext): Promise<PermissionCheckResult> {
    return this.permissionChecker.check(context);
  }

  /**
   * Check permission and throw if denied
   */
  async requirePermission(context: PermissionCheckContext): Promise<void> {
    return this.permissionChecker.checkOrThrow(context);
  }

  /**
   * Evaluate policy
   */
  async evaluatePolicy(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
    return this.policyEngine.evaluate(context);
  }

  /**
   * Get all permission codes
   */
  getPermissionCodes(): Record<string, string> {
    return this.registry.getPermissionCodesObject();
  }

  /**
   * Get all resource names
   */
  getResourceNames(): string[] {
    return this.registry.resources.names();
  }

  /**
   * Get resource by name
   */
  getResource(name: string): ResourceDefinition | undefined {
    return this.registry.resources.get(name);
  }

  /**
   * Export metadata for UI
   */
  exportMetadata(): ReturnType<UnifiedRegistry['exportMetadata']> {
    return this.registry.exportMetadata();
  }

  /**
   * Default permission resolver (uses policies)
   */
  private async defaultPermissionResolver(
    tenantId: string,
    subjectId: string
  ): Promise<Set<string>> {
    // Get all permissions from policies for this tenant/subject
    // This is a simplified implementation
    const permissions = new Set<string>();

    const policies = this.registry.policies.getForTenant(tenantId);

    for (const policy of policies) {
      for (const rule of policy.rules) {
        if (rule.effect === 'allow') {
          for (const perm of rule.permissions) {
            permissions.add(perm);
          }
        }
      }
    }

    return permissions;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get summary
   */
  getSummary(): {
    initialized: boolean;
    resources: number;
    permissions: number;
    policies: number;
    plugins: number;
  } {
    const registrySummary = this.registry.getSummary();

    return {
      initialized: this.initialized,
      ...registrySummary,
      plugins: this.plugins.list().length,
    };
  }
}

/**
 * Create MTPC instance
 */
export function createMTPC(options?: MTPCOptions): MTPC {
  return new MTPC(options);
}

/**
 * Default MTPC instance
 */
let defaultInstance: MTPC | null = null;

/**
 * Get or create default MTPC instance
 */
export function getDefaultMTPC(): MTPC {
  if (!defaultInstance) {
    defaultInstance = createMTPC();
  }
  return defaultInstance;
}

/**
 * Reset default instance (for testing)
 */
export function resetDefaultMTPC(): void {
  defaultInstance = null;
}
