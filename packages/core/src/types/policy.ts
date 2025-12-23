import type { RequestContext, SubjectContext } from './context.js';
import type { Permission } from './permission.js';
import type { TenantContext } from './tenant.js';

/**
 * Policy effect
 */
export type PolicyEffect = 'allow' | 'deny';

/**
 * Policy priority
 */
export type PolicyPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Policy condition type
 */
export type PolicyConditionType =
  | 'field' // Field comparison
  | 'time' // Time-based
  | 'ip' // IP-based
  | 'custom'; // Custom function

/**
 * Policy condition
 */
export interface PolicyCondition {
  type: PolicyConditionType;
  field?: string;
  operator?: string;
  value?: unknown;
  fn?: (context: PolicyEvaluationContext) => boolean | Promise<boolean>;
}

/**
 * Policy rule
 */
export interface PolicyRule {
  permissions: string[];
  effect: PolicyEffect;
  conditions?: PolicyCondition[];
  priority?: PolicyPriority;
  description?: string;
}

/**
 * Policy definition
 */
export interface PolicyDefinition {
  id: string;
  name: string;
  description?: string;
  rules: PolicyRule[];
  priority: PolicyPriority;
  enabled: boolean;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Compiled policy
 */
export interface CompiledPolicy {
  readonly id: string;
  readonly name: string;
  readonly rules: CompiledPolicyRule[];
  readonly priority: number;
  readonly enabled: boolean;
  readonly tenantId?: string;
}

/**
 * Compiled policy rule
 */
export interface CompiledPolicyRule {
  readonly permissions: Set<string>;
  readonly effect: PolicyEffect;
  readonly conditions: PolicyCondition[];
  readonly priority: number;
  readonly evaluate: (context: PolicyEvaluationContext) => Promise<boolean>;
}

/**
 * Policy evaluation context
 */
export interface PolicyEvaluationContext {
  tenant: TenantContext;
  subject: SubjectContext;
  request: RequestContext;
  permission: Permission;
  resource?: Record<string, unknown>;
  environment?: Record<string, unknown>;
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  effect: PolicyEffect;
  matchedPolicy?: string;
  matchedRule?: number;
  conditions?: {
    passed: PolicyCondition[];
    failed: PolicyCondition[];
  };
  evaluationPath?: string[];
}

/**
 * Policy engine interface
 */
export interface PolicyEngine {
  evaluate(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult>;
  addPolicy(policy: PolicyDefinition): void;
  removePolicy(policyId: string): void;
  getPolicy(policyId: string): PolicyDefinition | undefined;
  listPolicies(tenantId?: string): PolicyDefinition[];
  compile(policy: PolicyDefinition): CompiledPolicy;
}

/**
 * Policy provider interface
 */
export interface PolicyProvider {
  getPolicies(tenantId: string, subjectId: string): Promise<PolicyDefinition[]>;
  invalidate(tenantId: string, subjectId?: string): Promise<void>;
}
