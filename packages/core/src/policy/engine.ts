import type {
  PolicyDefinition,
  CompiledPolicy,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  PolicyEngine,
  PolicyEffect,
} from '../types/index.js';
import { compilePolicy, getPriorityValue } from './compiler.js';

/**
 * Default policy engine implementation
 */
export class DefaultPolicyEngine implements PolicyEngine {
  private policies: Map<string, PolicyDefinition> = new Map();
  private compiledPolicies: Map<string, CompiledPolicy> = new Map();
  private sortedPolicies: CompiledPolicy[] = [];
  private needsSort = false;

  /**
   * Evaluate policies against context
   */
  async evaluate(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
    if (this.needsSort) {
      this.sortPolicies();
    }

    const evaluationPath: string[] = [];
    
    // Get applicable policies for tenant
    const applicablePolicies = this.getApplicablePolicies(context.tenant.id);

    for (const policy of applicablePolicies) {
      if (!policy.enabled) {
        continue;
      }

      evaluationPath.push(`policy:${policy.id}`);

      for (let i = 0; i < policy.rules.length; i++) {
        const rule = policy.rules[i];
        
        // Check if rule applies to this permission
        if (!rule.permissions.has(context.permission.code) &&
            !rule.permissions.has('*') &&
            !rule.permissions.has(`${context.permission.resource}:*`)) {
          continue;
        }

        evaluationPath.push(`rule:${i}`);

        // Evaluate conditions
        const conditionsPassed: typeof rule.conditions = [];
        const conditionsFailed: typeof rule.conditions = [];
        let allConditionsMet = true;

        for (const condition of rule.conditions) {
          const result = await rule.evaluate(context);
          
          if (result) {
            conditionsPassed.push(condition);
          } else {
            conditionsFailed.push(condition);
            allConditionsMet = false;
            break;
          }
        }

        // If no conditions or all met, apply effect
        if (rule.conditions.length === 0 || allConditionsMet) {
          return {
            effect: rule.effect,
            matchedPolicy: policy.id,
            matchedRule: i,
            conditions: {
              passed: conditionsPassed,
              failed: conditionsFailed,
            },
            evaluationPath,
          };
        }
      }
    }

    // Default deny if no policy matched
    return {
      effect: 'deny',
      evaluationPath,
    };
  }

  /**
   * Add policy
   */
  addPolicy(policy: PolicyDefinition): void {
    this.policies.set(policy.id, policy);
    this.compiledPolicies.set(policy.id, compilePolicy(policy));
    this.needsSort = true;
  }

  /**
   * Remove policy
   */
  removePolicy(policyId: string): void {
    this.policies.delete(policyId);
    this.compiledPolicies.delete(policyId);
    this.needsSort = true;
  }

  /**
   * Get policy by ID
   */
  getPolicy(policyId: string): PolicyDefinition | undefined {
    return this.policies.get(policyId);
  }

  /**
   * List policies
   */
  listPolicies(tenantId?: string): PolicyDefinition[] {
    const policies = Array.from(this.policies.values());
    
    if (tenantId) {
      return policies.filter(p => !p.tenantId || p.tenantId === tenantId);
    }
    
    return policies;
  }

  /**
   * Compile policy
   */
  compile(policy: PolicyDefinition): CompiledPolicy {
    return compilePolicy(policy);
  }

  /**
   * Get applicable policies for tenant
   */
  private getApplicablePolicies(tenantId: string): CompiledPolicy[] {
    return this.sortedPolicies.filter(
      p => !p.tenantId || p.tenantId === tenantId
    );
  }

  /**
   * Sort policies by priority
   */
  private sortPolicies(): void {
    this.sortedPolicies = Array.from(this.compiledPolicies.values())
      .sort((a, b) => b.priority - a.priority);
    this.needsSort = false;
  }

  /**
   * Clear all policies
   */
  clear(): void {
    this.policies.clear();
    this.compiledPolicies.clear();
    this.sortedPolicies = [];
    this.needsSort = false;
  }
}

/**
 * Create a new policy engine
 */
export function createPolicyEngine(): PolicyEngine {
  return new DefaultPolicyEngine();
}
