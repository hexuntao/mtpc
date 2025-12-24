import type {
  PolicyCondition,
  PolicyDefinition,
  PolicyEvaluationContext,
  PolicyPriority,
  PolicyRule,
} from '@mtpc/core';

/**
 * 创建 ACL 主体引用
 * @param subjectId 主体 ID
 * @param role 角色
 * @returns ACL 主体引用
 */
export interface PrincipalRef {
  /** 主体 ID */
  subjectId?: string;
  /** 角色 */
  role?: string;
}

/**
 * ACL entry
 */
export interface ACLEntry {
  /** 资源路径 */
  resource: string;
  /** 操作 */
  action: string;
  /** 允许的主体引用 */
  allow?: PrincipalRef[];
  /** 拒绝的主体引用 */
  deny?: PrincipalRef[];
}

/**
 * ACL config
 */
export interface ACLConfig {
  /** 策略 ID */
  id: string;
  /** 租户 ID */
  tenantId?: string;
  /** ACL 条目 */
  entries: ACLEntry[];
  /** 策略描述 */
  description?: string;
  /** 策略优先级 */
  priority?: PolicyPriority;
}

/**
 * 检查上下文是否匹配主体引用
 * @param ctx 策略评估上下文
 * @param principal 主体引用
 * @returns 是否匹配
 */
function matchesPrincipal(ctx: PolicyEvaluationContext, principal: PrincipalRef): boolean {
  if (principal.subjectId && ctx.subject.id === principal.subjectId) {
    return true;
  }
  if (principal.role && ctx.subject.roles?.includes(principal.role)) {
    return true;
  }
  return false;
}

/**
 * 创建自定义条件，检查主体是否匹配任何主体引用
 * @param principals 主体引用数组
 * @returns 自定义条件
 */
function principalCondition(principals: PrincipalRef[]): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => principals.some(p => matchesPrincipal(ctx, p)),
  } as PolicyCondition;
}

/**
 * 将 ACL 配置转换为策略定义
 *
 * 规则：
 * - 对每个 ACLEntry 生成一个 PolicyDefinition，包含 allow/deny 两条 rule（若存在）。
 * - deny rule 的优先级设置高于 allow，以符合 ACL 的“拒绝优先”语义。
 */
export function toPolicies(config: ACLConfig): PolicyDefinition[] {
  const policies: PolicyDefinition[] = [];

  for (const entry of config.entries) {
    const rules: PolicyRule[] = [];
    const permission = `${entry.resource}:${entry.action}`;

    if (entry.deny && entry.deny.length > 0) {
      rules.push({
        permissions: [permission],
        effect: 'deny',
        conditions: [principalCondition(entry.deny)],
        priority: 'high',
        description: 'ACL deny rule',
      });
    }

    if (entry.allow && entry.allow.length > 0) {
      rules.push({
        permissions: [permission],
        effect: 'allow',
        conditions: [principalCondition(entry.allow)],
        priority: 'normal',
        description: 'ACL allow rule',
      });
    }

    if (rules.length === 0) continue;

    const policy: PolicyDefinition = {
      id: `${config.id}::${entry.resource}::${entry.action}`,
      name: `ACL for ${entry.resource}:${entry.action}`,
      description: config.description,
      rules,
      priority: config.priority ?? 'normal',
      enabled: true,
      tenantId: config.tenantId,
      metadata: {
        acl: true,
      },
    };

    policies.push(policy);
  }

  return policies;
}
