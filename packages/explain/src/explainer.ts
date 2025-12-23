import type {
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
  ExplainLevel,
  ExplainOptions,
  ExplanationContext,
  PermissionExplanation,
  PolicyResult,
  RuleResult,
} from './types.js';

/**
 * 权限解释器
 * 用于解释权限决策结果，提供详细的决策原因和评估过程
 */
export class PermissionExplainer {
  /** 策略引擎，用于评估策略 */
  private policyEngine: PolicyEngine;
  /** 权限解析器，用于获取主体的权限 */
  private permissionResolver: (tenantId: string, subjectId: string) => Promise<Set<string>>;
  /** 默认的解释详细级别 */
  private defaultLevel: ExplainLevel;

  /**
   * 创建权限解释器实例
   * @param policyEngine 策略引擎实例
   * @param permissionResolver 权限解析器函数
   * @param options 选项，包含默认解释级别
   */
  constructor(
    policyEngine: PolicyEngine,
    permissionResolver: (tenantId: string, subjectId: string) => Promise<Set<string>>,
    options: { defaultLevel?: ExplainLevel } = {}
  ) {
    this.policyEngine = policyEngine;
    this.permissionResolver = permissionResolver;
    this.defaultLevel = options.defaultLevel ?? 'standard'; // 默认标准级别
  }

  /**
   * 解释单个权限决策
   * @param tenant 租户上下文
   * @param subject 主体上下文
   * @param permission 权限代码
   * @param options 解释选项
   * @returns 权限解释结果
   */
  async explain(
    tenant: TenantContext,
    subject: SubjectContext,
    permission: string,
    options: ExplainOptions = {}
  ): Promise<PermissionExplanation> {
    const startTime = Date.now();
    const level = options.level ?? this.defaultLevel;

    // 解析权限代码
    const parsed = parsePermissionCode(permission);
    if (!parsed) {
      return this.createNotApplicableExplanation(
        permission,
        '无效的权限代码格式',
        tenant,
        subject,
        startTime
      );
    }

    const { resource, action } = parsed;

    // 获取主体的权限集合
    const subjectPermissions = await this.permissionResolver(tenant.id, subject.id);

    // 检查是否有通配符权限
    if (subjectPermissions.has('*')) {
      return this.createAllowExplanation(
        permission,
        resource,
        action,
        '通配符权限 (*) 授予访问权限',
        tenant,
        subject,
        startTime,
        { matchedPolicy: 'wildcard' }
      );
    }

    // 检查是否有资源通配符权限
    if (subjectPermissions.has(`${resource}:*`)) {
      return this.createAllowExplanation(
        permission,
        resource,
        action,
        `资源通配符 (${resource}:*) 授予访问权限`,
        tenant,
        subject,
        startTime,
        { matchedPolicy: 'resource-wildcard' }
      );
    }

    // 检查是否有精确匹配的权限
    if (subjectPermissions.has(permission)) {
      return this.createAllowExplanation(
        permission,
        resource,
        action,
        '权限被明确授予',
        tenant,
        subject,
        startTime
      );
    }

    // 构建策略评估上下文
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

    // 评估策略
    const policyResult = await this.policyEngine.evaluate(evalContext);

    // 构建解释结果
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

    // 如果请求包含策略详情且级别不是最小化，则添加策略评估结果
    if (options.includePolicies && level !== 'minimal') {
      explanation.policies = await this.getPolicyResults(tenant.id, evalContext);
    }

    return explanation;
  }

  /**
   * 批量解释多个权限决策
   * @param request 批量解释请求
   * @returns 批量解释结果
   */
  async explainBulk(request: BulkExplainRequest): Promise<BulkExplainResult> {
    const startTime = Date.now();
    const explanations: PermissionExplanation[] = [];

    // 遍历权限列表，逐个解释
    for (const permission of request.permissions) {
      const explanation = await this.explain(
        request.tenant,
        request.subject,
        permission,
        request.options
      );
      explanations.push(explanation);
    }

    // 统计结果
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
   * 解释主体的角色和权限来源
   * @param tenant 租户上下文
   * @param subject 主体上下文
   * @returns 包含角色、权限和来源的对象
   */
  async explainSubject(
    tenant: TenantContext,
    subject: SubjectContext
  ): Promise<{
    roles: string[];
    permissions: string[];
    sources: Array<{ permission: string; source: string }>;
  }> {
    // 获取主体的权限
    const permissions = await this.permissionResolver(tenant.id, subject.id);
    const roles = subject.roles ?? [];

    // 构建权限来源列表
    const sources: Array<{ permission: string; source: string }> = [];

    for (const perm of permissions) {
      sources.push({
        permission: perm,
        source: 'resolved', // 在实际实现中，应跟踪权限的实际来源
      });
    }

    return {
      roles,
      permissions: Array.from(permissions),
      sources,
    };
  }

  /**
   * 创建允许访问的解释结果
   * @param permission 权限代码
   * @param resource 资源名称
   * @param action 操作名称
   * @param reason 决策原因
   * @param tenant 租户上下文
   * @param subject 主体上下文
   * @param startTime 开始时间戳
   * @param extras 额外的解释信息
   * @returns 权限解释结果
   */
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

  /**
   * 创建不适用的解释结果
   * @param permission 权限代码
   * @param reason 决策原因
   * @param tenant 租户上下文
   * @param subject 主体上下文
   * @param startTime 开始时间戳
   * @returns 权限解释结果
   */
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

  /**
   * 构建决策原因
   * @param result 策略评估结果
   * @param permission 权限代码
   * @returns 决策原因字符串
   */
  private buildReason(
    result: { effect: 'allow' | 'deny'; matchedPolicy?: string; matchedRule?: number },
    permission: string
  ): string {
    if (result.effect === 'allow') {
      if (result.matchedPolicy) {
        return `由策略 "${result.matchedPolicy}" 规则 #${result.matchedRule ?? 0} 允许`;
      }
      return '权限被授予';
    }

    if (result.matchedPolicy) {
      return `由策略 "${result.matchedPolicy}" 规则 #${result.matchedRule ?? 0} 拒绝`;
    }

    return `权限 "${permission}" 未授予给主体`;
  }

  /**
   * 构建解释上下文
   * @param tenant 租户上下文
   * @param subject 主体上下文
   * @param options 解释选项
   * @returns 解释上下文
   */
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

  /**
   * 获取策略评估结果
   * @param tenantId 租户ID
   * @param context 策略评估上下文
   * @returns 策略评估结果列表
   */
  private async getPolicyResults(
    tenantId: string,
    context: PolicyEvaluationContext
  ): Promise<PolicyResult[]> {
    // 获取租户的所有策略
    const policies = this.policyEngine.listPolicies(tenantId);
    const results: PolicyResult[] = [];

    // 评估每个策略
    for (const policy of policies) {
      const ruleResults: RuleResult[] = [];

      // 评估策略的每个规则
      for (let i = 0; i < policy.rules.length; i++) {
        const rule = policy.rules[i];
        const conditionResults: ConditionResult[] = [];

        // 检查规则是否适用
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

    // 按优先级排序，优先级高的策略排在前面
    return results.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 将优先级字符串转换为数值
   * @param priority 优先级字符串
   * @returns 优先级数值，数值越大，优先级越高
   */
  private getPriorityValue(priority: string): number {
    const values: Record<string, number> = {
      low: 10,      // 低优先级
      normal: 50,   // 正常优先级
      high: 100,    // 高优先级
      critical: 1000, // 关键优先级
    };
    return values[priority] ?? 50; // 默认正常优先级
  }
}

/**
 * 创建权限解释器实例
 * @param policyEngine 策略引擎实例
 * @param permissionResolver 权限解析器函数
 * @param options 选项，包含默认解释级别
 * @returns 权限解释器实例
 */
export function createExplainer(
  policyEngine: PolicyEngine,
  permissionResolver: (tenantId: string, subjectId: string) => Promise<Set<string>>,
  options?: { defaultLevel?: ExplainLevel }
): PermissionExplainer {
  return new PermissionExplainer(policyEngine, permissionResolver, options);
}
