import { compilePolicy } from '../policy/compiler.js';
import type { CompiledPolicy, PolicyDefinition } from '../types/index.js';

/**
 * Policy registry
 */
export class PolicyRegistry {
  private policies: Map<string, PolicyDefinition> = new Map();
  private compiledPolicies: Map<string, CompiledPolicy> = new Map();
  private byTenant: Map<string, Set<string>> = new Map();
  private globalPolicies: Set<string> = new Set();

  /**
   * Register a policy
   */
  register(policy: PolicyDefinition): CompiledPolicy {
    this.policies.set(policy.id, policy);

    const compiled = compilePolicy(policy);
    this.compiledPolicies.set(policy.id, compiled);

    // Index by tenant
    if (policy.tenantId) {
      let tenantPolicies = this.byTenant.get(policy.tenantId);
      if (!tenantPolicies) {
        tenantPolicies = new Set();
        this.byTenant.set(policy.tenantId, tenantPolicies);
      }
      tenantPolicies.add(policy.id);
    } else {
      this.globalPolicies.add(policy.id);
    }

    return compiled;
  }

  /**
   * Register multiple policies
   */
  registerMany(policies: PolicyDefinition[]): CompiledPolicy[] {
    return policies.map(p => this.register(p));
  }

  /**
   * Unregister a policy
   */
  unregister(policyId: string): void {
    const policy = this.policies.get(policyId);

    if (!policy) {
      return;
    }

    this.policies.delete(policyId);
    this.compiledPolicies.delete(policyId);

    if (policy.tenantId) {
      const tenantPolicies = this.byTenant.get(policy.tenantId);
      tenantPolicies?.delete(policyId);
    } else {
      this.globalPolicies.delete(policyId);
    }
  }

  /**
   * Get policy by ID
   */
  get(policyId: string): PolicyDefinition | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get compiled policy
   */
  getCompiled(policyId: string): CompiledPolicy | undefined {
    return this.compiledPolicies.get(policyId);
  }

  /**
   * Check if policy exists
   */
  has(policyId: string): boolean {
    return this.policies.has(policyId);
  }

  /**
   * List all policies
   */
  list(): PolicyDefinition[] {
    return Array.from(this.policies.values());
  }

  /**
   * List compiled policies
   */
  listCompiled(): CompiledPolicy[] {
    return Array.from(this.compiledPolicies.values());
  }

  /**
   * Get policies for tenant (including global)
   */
  getForTenant(tenantId: string): PolicyDefinition[] {
    const tenantPolicyIds = this.byTenant.get(tenantId) ?? new Set();
    const allIds = new Set([...this.globalPolicies, ...tenantPolicyIds]);

    return Array.from(allIds)
      .map(id => this.policies.get(id)!)
      .filter(Boolean)
      .filter(p => p.enabled);
  }

  /**
   * Get compiled policies for tenant
   */
  getCompiledForTenant(tenantId: string): CompiledPolicy[] {
    const tenantPolicyIds = this.byTenant.get(tenantId) ?? new Set();
    const allIds = new Set([...this.globalPolicies, ...tenantPolicyIds]);

    return Array.from(allIds)
      .map(id => this.compiledPolicies.get(id)!)
      .filter(Boolean)
      .filter(p => p.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get global policies
   */
  getGlobal(): PolicyDefinition[] {
    return Array.from(this.globalPolicies)
      .map(id => this.policies.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get count
   */
  get size(): number {
    return this.policies.size;
  }

  /**
   * Clear all
   */
  clear(): void {
    this.policies.clear();
    this.compiledPolicies.clear();
    this.byTenant.clear();
    this.globalPolicies.clear();
  }

  /**
   * Update policy
   */
  update(policyId: string, updates: Partial<PolicyDefinition>): CompiledPolicy | undefined {
    const existing = this.policies.get(policyId);

    if (!existing) {
      return undefined;
    }

    // Remove old
    this.unregister(policyId);

    // Register updated
    const updated: PolicyDefinition = {
      ...existing,
      ...updates,
      id: policyId, // ID cannot change
    };

    return this.register(updated);
  }
}

/**
 * Create a policy registry
 */
export function createPolicyRegistry(): PolicyRegistry {
  return new PolicyRegistry();
}
