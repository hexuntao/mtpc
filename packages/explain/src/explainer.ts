import type {
  Permission,
  PolicyEngine,
  PolicyEvaluationContext,
  SubjectContext,
  TenantContext,
} from '@mtpc/core';
import { parsePermissionCode } from '@mtpc/shared';
import type {
  BulkExplainRequest,
  BulkExplainResult,
  ConditionResult,
  DecisionType,
  ExplainLevel,
  ExplainOptions,
  ExplanationContext,
  PermissionExplanation,
  PolicyResult,
  RuleResult,
} from './types.js';

/**
 * Permission explainer
 */
export class PermissionExplainer {
  private policyEngine: PolicyEngine;
  private permissionResolver: (tenantId: string, subjectId: string) => Promise<Set<string>>;
  private defaultLevel: ExplainLevel;

  constructor(
    policyEngine: PolicyEngine,
    permissionResolver: (tenantId: string, subjectId: string) => Promise<Set<string>>,
    options: { defaultLevel?: ExplainLevel } = {}
  ) {
    this.policyEngine = policyEngine;
    this.permissionResolver = permissionResolver;
    this.defaultLevel = options.defaultLevel ?? 'standard';
  }

  /**
   * Explain permission decision
   */
  async explain(
    tenant: TenantContext,
    subject: SubjectContext,
    permission: string,
    options: ExplainOptions = {}
  ): Promise<PermissionExplanation> {
    const startTime = Date.now();
    const level = options.level ?? this.defaultLevel;

    // Parse permission
    const parsed = parsePermissionCode(permission);
    if (!parsed) {
      return this.createNotApplicableExplanation(
        permission,
        'Invalid permission code format',
        tenant,
        subject,
        startTime
      );
    }

    const { resource, action } = parsed;

    // Get subject's permissions
    const subjectPermissions = await this.permissionResolver(tenant.id, subject.id);

    // Check for wildcard
    if (subjectPermissions.has('*')) {
      return this.createAllowExplanation(
        permission,
        resource,
        action,
        'Wildcard permission (*) grants access',
        tenant,
        subject,
        startTime,
        { matchedPolicy: 'wildcard' }
      );
    }

    // Check for resource wildcard
    if (subjectPermissions.has(`${resource}:*`)) {
      return this.createAllowExplanation(
        permission,
        resource,
        action,
        `Resource wildcard (${resource}:*) grants access`,
        tenant,
        subject,
        startTime,
        { matchedPolicy: 'resource-wildcard' }
      );
    }

    // Check for exact permission
    if (subjectPermissions.has(permission)) {
      return this.createAllowExplanation(
        permission,
        resource,
        action,
        'Permission explicitly granted',
        tenant,
        subject,
        startTime
      );
    }

    // Build policy evaluation context
    const evalContext: PolicyEvaluationContext = {
      tenant,
      subject,
      request: {
        requestId: 'explain',
        timestamp: new Date(),
      },
      permission: {
        code: permission,
        resource,
        action,
        scope: 'tenant',
        conditions: [],
        metadata: {},
      },
    };

    // Evaluate policies
    const policyResult = await this.policyEngine.evaluate(evalContext);

    // Build explanation
    const explanation: PermissionExplanation = {
      permission,
      resource,
      action,
      decision: policyResult.effect === 'allow' ? 'allow' : 'deny',
      reason: this.buildReason(policyResult, permission),
      matchedPolicy: policyResult.matchedPolicy,
      matchedRule: policyResult.matchedRule,
      evaluationPath: policyResult.evaluationPath ?? [],
      timestamp: new Date(),
      duration: Date.now() - startTime,
      context: this.buildContext(tenant, subject, options),
    };

    // Add policy details if requested
    if (options.includePolicies && level !== 'minimal') {
      explanation.policies = await this.getPolicyResults(tenant.id, evalContext);
    }

    return explanation;
  }

  /**
   * Explain multiple permissions
   */
  async explainBulk(request: BulkExplainRequest): Promise<BulkExplainResult> {
    const startTime = Date.now();
    const explanations: PermissionExplanation[] = [];

    for (const permission of request.permissions) {
      const explanation = await this.explain(
        request.tenant,
        request.subject,
        permission,
        request.options
      );
      explanations.push(explanation);
    }

    const allowed = explanations.filter(e => e.decision === 'allow').length;
    const denied = explanations.filter(e => e.decision === 'deny').length;
    const notApplicable = explanations.filter(e => e.decision === 'not_applicable').length;

    return {
      explanations,
      summary: {
        total: explanations.length,
        allowed,
        denied,
        notApplicable,
      },
      duration: Date.now() - startTime,
    };
  }

  /**
   * Explain why subject has certain roles/permissions
   */
  async explainSubject(
    tenant: TenantContext,
    subject: SubjectContext
  ): Promise<{
    roles: string[];
    permissions: string[];
    sources: Array<{ permission: string; source: string }>;
  }> {
    const permissions = await this.permissionResolver(tenant.id, subject.id);
    const roles = subject.roles ?? [];

    const sources: Array<{ permission: string; source: string }> = [];

    for (const perm of permissions) {
      sources.push({
        permission: perm,
        source: 'resolved', // In real implementation, track source
      });
    }

    return {
      roles,
      permissions: Array.from(permissions),
      sources,
    };
  }

  private createAllowExplanation(
    permission: string,
    resource: string,
    action: string,
    reason: string,
    tenant: TenantContext,
    subject: SubjectContext,
    startTime: number,
    extras?: Partial<PermissionExplanation>
  ): PermissionExplanation {
    return {
      permission,
      resource,
      action,
      decision: 'allow',
      reason,
      evaluationPath: ['permission-check'],
      timestamp: new Date(),
      duration: Date.now() - startTime,
      context: this.buildContext(tenant, subject, {}),
      ...extras,
    };
  }

  private createNotApplicableExplanation(
    permission: string,
    reason: string,
    tenant: TenantContext,
    subject: SubjectContext,
    startTime: number
  ): PermissionExplanation {
    return {
      permission,
      resource: '',
      action: '',
      decision: 'not_applicable',
      reason,
      evaluationPath: [],
      timestamp: new Date(),
      duration: Date.now() - startTime,
      context: this.buildContext(tenant, subject, {}),
    };
  }

  private buildReason(
    result: { effect: 'allow' | 'deny'; matchedPolicy?: string; matchedRule?: number },
    permission: string
  ): string {
    if (result.effect === 'allow') {
      if (result.matchedPolicy) {
        return `Allowed by policy "${result.matchedPolicy}" rule #${result.matchedRule ?? 0}`;
      }
      return 'Permission granted';
    }

    if (result.matchedPolicy) {
      return `Denied by policy "${result.matchedPolicy}" rule #${result.matchedRule ?? 0}`;
    }

    return `Permission "${permission}" not granted to subject`;
  }

  private buildContext(
    tenant: TenantContext,
    subject: SubjectContext,
    options: ExplainOptions
  ): ExplanationContext {
    return {
      tenant: {
        id: tenant.id,
        status: tenant.status,
      },
      subject: {
        id: subject.id,
        type: subject.type,
        roles: options.includeContext ? subject.roles : undefined,
      },
      environment: options.includeContext
        ? {
            timestamp: new Date(),
          }
        : undefined,
    };
  }

  private async getPolicyResults(
    tenantId: string,
    context: PolicyEvaluationContext
  ): Promise<PolicyResult[]> {
    const policies = this.policyEngine.listPolicies(tenantId);
    const results: PolicyResult[] = [];

    for (const policy of policies) {
      const ruleResults: RuleResult[] = [];

      // Evaluate each rule
      for (let i = 0; i < policy.rules.length; i++) {
        const rule = policy.rules[i];
        const conditionResults: ConditionResult[] = [];

        // Check if rule applies
        const applies =
          rule.permissions.includes(context.permission.code) ||
          rule.permissions.includes('*') ||
          rule.permissions.includes(`${context.permission.resource}:*`);

        ruleResults.push({
          ruleIndex: i,
          matched: applies,
          effect: rule.effect,
          conditionResults,
          description: rule.description,
        });
      }

      results.push({
        policyId: policy.id,
        policyName: policy.name,
        matched: ruleResults.some(r => r.matched),
        ruleResults,
        priority: this.getPriorityValue(policy.priority),
        enabled: policy.enabled,
      });
    }

    return results.sort((a, b) => b.priority - a.priority);
  }

  private getPriorityValue(priority: string): number {
    const values: Record<string, number> = {
      low: 10,
      normal: 50,
      high: 100,
      critical: 1000,
    };
    return values[priority] ?? 50;
  }
}

/**
 * Create permission explainer
 */
export function createExplainer(
  policyEngine: PolicyEngine,
  permissionResolver: (tenantId: string, subjectId: string) => Promise<Set<string>>,
  options?: { defaultLevel?: ExplainLevel }
): PermissionExplainer {
  return new PermissionExplainer(policyEngine, permissionResolver, options);
}
