import type {
  PolicyDefinition,
  CompiledPolicy,
  CompiledPolicyRule,
  PolicyCondition,
  PolicyPriority,
  PolicyEvaluationContext,
} from '../types/index.js';
import { evaluateCondition } from './conditions.js';

/**
 * Priority value mapping
 */
const PRIORITY_VALUES: Record<PolicyPriority, number> = {
  low: 10,
  normal: 50,
  high: 100,
  critical: 1000,
};

/**
 * Get numeric priority value
 */
export function getPriorityValue(priority: PolicyPriority): number {
  return PRIORITY_VALUES[priority] ?? PRIORITY_VALUES.normal;
}

/**
 * Compile a policy definition
 */
export function compilePolicy(policy: PolicyDefinition): CompiledPolicy {
  const compiledRules: CompiledPolicyRule[] = policy.rules.map((rule, index) => {
    const permissions = new Set(rule.permissions);
    const conditions = rule.conditions ?? [];
    const rulePriority = getPriorityValue(rule.priority ?? policy.priority);

    return {
      permissions,
      effect: rule.effect,
      conditions,
      priority: rulePriority + index * 0.001, // Sub-ordering by rule index
      evaluate: createRuleEvaluator(conditions),
    };
  });

  // Sort rules by priority (highest first)
  compiledRules.sort((a, b) => b.priority - a.priority);

  return {
    id: policy.id,
    name: policy.name,
    rules: compiledRules,
    priority: getPriorityValue(policy.priority),
    enabled: policy.enabled,
    tenantId: policy.tenantId,
  };
}

/**
 * Create a rule evaluator function
 */
function createRuleEvaluator(
  conditions: PolicyCondition[]
): (context: PolicyEvaluationContext) => Promise<boolean> {
  return async (context: PolicyEvaluationContext): Promise<boolean> => {
    if (conditions.length === 0) {
      return true;
    }

    for (const condition of conditions) {
      const result = await evaluateCondition(condition, context);
      if (!result) {
        return false;
      }
    }

    return true;
  };
}

/**
 * Compile multiple policies
 */
export function compilePolicies(policies: PolicyDefinition[]): CompiledPolicy[] {
  return policies
    .map(compilePolicy)
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Merge multiple policies into one
 */
export function mergePolicies(
  policies: PolicyDefinition[],
  options: { id: string; name: string }
): PolicyDefinition {
  const allRules = policies.flatMap(p => p.rules);
  
  // Find highest priority
  let maxPriority: PolicyPriority = 'low';
  for (const policy of policies) {
    if (getPriorityValue(policy.priority) > getPriorityValue(maxPriority)) {
      maxPriority = policy.priority;
    }
  }

  return {
    id: options.id,
    name: options.name,
    rules: allRules,
    priority: maxPriority,
    enabled: true,
  };
}
