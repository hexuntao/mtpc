import type {
  Permission,
  PolicyCondition,
  PolicyDefinition,
  SubjectContext,
  TenantContext,
} from '@mtpc/core';

/**
 * Explanation detail level
 */
export type ExplainLevel = 'minimal' | 'standard' | 'detailed' | 'debug';

/**
 * Decision type
 */
export type DecisionType = 'allow' | 'deny' | 'not_applicable';

/**
 * Condition evaluation result
 */
export interface ConditionResult {
  condition: PolicyCondition;
  passed: boolean;
  actualValue?: unknown;
  expectedValue?: unknown;
  error?: string;
}

/**
 * Rule evaluation result
 */
export interface RuleResult {
  ruleIndex: number;
  matched: boolean;
  effect: 'allow' | 'deny';
  conditionResults: ConditionResult[];
  description?: string;
}

/**
 * Policy evaluation result
 */
export interface PolicyResult {
  policyId: string;
  policyName: string;
  matched: boolean;
  effect?: 'allow' | 'deny';
  ruleResults: RuleResult[];
  priority: number;
  enabled: boolean;
}

/**
 * Permission explanation
 */
export interface PermissionExplanation {
  permission: string;
  resource: string;
  action: string;
  decision: DecisionType;
  reason: string;
  matchedPolicy?: string;
  matchedRule?: number;
  evaluationPath: string[];
  timestamp: Date;
  duration: number;
  context: ExplanationContext;
  policies?: PolicyResult[];
}

/**
 * Explanation context
 */
export interface ExplanationContext {
  tenant: {
    id: string;
    status?: string;
  };
  subject: {
    id: string;
    type: string;
    roles?: string[];
  };
  resource?: Record<string, unknown>;
  environment?: {
    timestamp: Date;
    ip?: string;
  };
}

/**
 * Explain options
 */
export interface ExplainOptions {
  level?: ExplainLevel;
  includePolicies?: boolean;
  includeConditions?: boolean;
  includeContext?: boolean;
  maxPolicies?: number;
}

/**
 * Bulk explanation request
 */
export interface BulkExplainRequest {
  tenant: TenantContext;
  subject: SubjectContext;
  permissions: string[];
  options?: ExplainOptions;
}

/**
 * Bulk explanation result
 */
export interface BulkExplainResult {
  explanations: PermissionExplanation[];
  summary: {
    total: number;
    allowed: number;
    denied: number;
    notApplicable: number;
  };
  duration: number;
}

/**
 * Explanation formatter
 */
export interface ExplanationFormatter {
  format(explanation: PermissionExplanation): string;
  formatBulk(result: BulkExplainResult): string;
}
