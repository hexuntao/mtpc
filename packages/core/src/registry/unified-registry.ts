import type {
  ResourceDefinition,
  Permission,
  PolicyDefinition,
  CompiledPolicy,
  PermissionDefinition,
} from '../types/index.js';
import { ResourceRegistry } from './resource-registry.js';
import { PermissionRegistry } from './permission-registry.js';
import { PolicyRegistry } from './policy-registry.js';

/**
 * Unified registry that manages all MTPC registries
 */
export class UnifiedRegistry {
  readonly resources: ResourceRegistry;
  readonly permissions: PermissionRegistry;
  readonly policies: PolicyRegistry;

  constructor() {
    this.resources = new ResourceRegistry();
    this.permissions = new PermissionRegistry();
    this.policies = new PolicyRegistry();
  }

  /**
   * Register a resource and its permissions
   */
  registerResource(resource: ResourceDefinition): void {
    this.resources.register(resource);
    this.permissions.registerMany(resource.name, resource.permissions);
  }

  /**
   * Register multiple resources
   */
  registerResources(resources: ResourceDefinition[]): void {
    for (const resource of resources) {
      this.registerResource(resource);
    }
  }

  /**
   * Register a policy
   */
  registerPolicy(policy: PolicyDefinition): CompiledPolicy {
    return this.policies.register(policy);
  }

  /**
   * Register multiple policies
   */
  registerPolicies(policies: PolicyDefinition[]): CompiledPolicy[] {
    return this.policies.registerMany(policies);
  }

  /**
   * Get all permission codes
   */
  getAllPermissionCodes(): string[] {
    return this.permissions.codes();
  }

  /**
   * Get permission codes as object
   */
  getPermissionCodesObject(): Record<string, string> {
    return this.permissions.toCodesObject();
  }

  /**
   * Get resource with its permissions
   */
  getResourceWithPermissions(name: string): {
    resource: ResourceDefinition;
    permissions: Permission[];
  } | undefined {
    const resource = this.resources.get(name);
    
    if (!resource) {
      return undefined;
    }

    return {
      resource,
      permissions: this.permissions.getByResource(name),
    };
  }

  /**
   * Freeze all registries
   */
  freeze(): void {
    this.resources.freeze();
    this.permissions.freeze();
  }

  /**
   * Check if frozen
   */
  isFrozen(): boolean {
    return this.resources.isFrozen() && this.permissions.isFrozen();
  }

  /**
   * Get summary
   */
  getSummary(): {
    resources: number;
    permissions: number;
    policies: number;
  } {
    return {
      resources: this.resources.size,
      permissions: this.permissions.size,
      policies: this.policies.size,
    };
  }

  /**
   * Clear all (for testing)
   */
  clear(): void {
    this.resources.clear();
    this.permissions.clear();
    this.policies.clear();
  }

  /**
   * Export metadata for UI consumption
   */
  exportMetadata(): {
    resources: Array<{
      name: string;
      displayName: string;
      permissions: string[];
      features: ResourceDefinition['features'];
      metadata: ResourceDefinition['metadata'];
    }>;
  } {
    return {
      resources: this.resources.list().map(r => ({
        name: r.name,
        displayName: r.metadata.displayName ?? r.name,
        permissions: this.permissions.getCodesByResource(r.name),
        features: r.features,
        metadata: r.metadata,
      })),
    };
  }
}

/**
 * Create a unified registry
 */
export function createUnifiedRegistry(): UnifiedRegistry {
  return new UnifiedRegistry();
}

/**
 * Global registry instance
 */
let globalRegistry: UnifiedRegistry | null = null;

/**
 * Get or create global registry
 */
export function getGlobalRegistry(): UnifiedRegistry {
  if (!globalRegistry) {
    globalRegistry = createUnifiedRegistry();
  }
  return globalRegistry;
}

/**
 * Reset global registry (for testing)
 */
export function resetGlobalRegistry(): void {
  globalRegistry = null;
}
