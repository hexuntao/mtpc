import type {
  CompiledPolicy,
  CompiledPolicyRule,
  PolicyCondition,
  PolicyDefinition,
  PolicyEvaluationContext,
  PolicyPriority,
} from '../types/index.js';
import { evaluateCondition } from './conditions.js';

/**
 * 优先级数值映射
 * 将策略优先级转换为数值，用于排序和比较
 */
const PRIORITY_VALUES: Record<PolicyPriority, number> = {
  low: 10,
  normal: 50,
  high: 100,
  critical: 1000,
};

/**
 * 获取优先级数值
 * 将策略优先级枚举转换为对应的数值
 *
 * @param priority 策略优先级
 * @returns 优先级对应的数值
 *
 * @example
 * ```typescript
 * getPriorityValue('low'); // 10
 * getPriorityValue('critical'); // 1000
 * getPriorityValue('normal'); // 50
 * ```
 */
export function getPriorityValue(priority: PolicyPriority): number {
  return PRIORITY_VALUES[priority] ?? PRIORITY_VALUES.normal;
}

/**
 * 编译策略定义
 * 将策略定义转换为编译后的格式，优化运行时性能
 * - 将权限数组转换为 Set 以提高查找效率
 * - 创建条件评估函数
 * - 按优先级排序规则
 * - 添加子排序（基于规则索引）确保稳定性
 *
 * @param policy 策略定义对象
 * @returns 编译后的策略对象
 *
 * @example
 * ```typescript
 * const policy = {
 *   id: 'my-policy',
 *   name: '我的策略',
 *   rules: [
 *     {
 *       permissions: ['user:read'],
 *       effect: 'allow',
 *       conditions: []
 *     }
 *   ],
 *   priority: 'normal',
 *   enabled: true
 * };
 *
 * const compiled = compilePolicy(policy);
 * ```
 */
export function compilePolicy(policy: PolicyDefinition): CompiledPolicy {
  // 输入验证
  if (!policy || typeof policy !== 'object') {
    throw new Error('policy 必须是对象');
  }

  if (!policy.id || typeof policy.id !== 'string') {
    throw new Error('policy.id 必须是字符串');
  }

  if (!policy.rules || !Array.isArray(policy.rules)) {
    throw new Error('policy.rules 必须是数组');
  }

  // 编译规则
  const compiledRules: CompiledPolicyRule[] = policy.rules.map((rule, index) => {
    // 输入验证
    if (!rule || typeof rule !== 'object') {
      throw new Error(`policy.rules[${index}] 必须是对象`);
    }

    if (!rule.permissions || !Array.isArray(rule.permissions) || rule.permissions.length === 0) {
      throw new Error(`policy.rules[${index}].permissions 必须是非空数组`);
    }

    if (!rule.effect || (rule.effect !== 'allow' && rule.effect !== 'deny')) {
      throw new Error(`policy.rules[${index}].effect 必须是 "allow" 或 "deny"`);
    }

    const permissions = new Set(rule.permissions);
    const conditions = rule.conditions ?? [];
    const rulePriority = getPriorityValue(rule.priority ?? policy.priority);

    return {
      permissions,
      effect: rule.effect,
      conditions,
      priority: rulePriority + index * 0.001, // 子排序（基于规则索引）
      evaluate: createRuleEvaluator(conditions),
    };
  });

  // 按优先级排序（高优先级在前）
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
 * 创建规则评估器函数
 * 根据条件列表创建异步评估函数，用于运行时快速评估
 *
 * @param conditions 策略条件数组
 * @returns 异步评估函数，接收评估上下文并返回布尔值
 *
 * @example
 * ```typescript
 * const evaluator = createRuleEvaluator([
 *   { type: 'field', field: 'role', operator: 'eq', value: 'admin' }
 * ]);
 *
 * const result = await evaluator({
 *   tenant: { id: 'tenant-1' },
 *   subject: { id: 'user-1', attributes: { role: 'admin' } },
 *   permission: { code: 'user:read', resource: 'user', action: 'read' },
 *   resource: {}
 * });
 * ```
 */
function createRuleEvaluator(
  conditions: PolicyCondition[]
): (context: PolicyEvaluationContext) => Promise<boolean> {
  return async (context: PolicyEvaluationContext): Promise<boolean> => {
    // 如果没有条件，直接返回 true
    if (conditions.length === 0) {
      return true;
    }

    // 逐个评估条件，所有条件都必须满足
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
 * 编译多个策略
 * 批量编译策略定义并按优先级排序
 *
 * @param policies 策略定义数组
 * @returns 编译后的策略数组，按优先级降序排列
 *
 * @example
 * ```typescript
 * const policies = [policy1, policy2, policy3];
 * const compiled = compilePolicies(policies);
 * // 返回按优先级排序的编译策略
 * ```
 */
export function compilePolicies(policies: PolicyDefinition[]): CompiledPolicy[] {
  // 输入验证
  if (!policies || !Array.isArray(policies)) {
    throw new Error('policies 必须是数组');
  }

  // 编译所有策略并按优先级排序
  return policies
    .map(policy => {
      try {
        return compilePolicy(policy);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`编译策略失败: ${policy?.id}, ${errorMessage}`);
      }
    })
    .sort((a, b) => b.priority - a.priority);
}

/**
 * 合并多个策略
 * 将多个策略合并为一个策略，保留所有规则并使用最高优先级
 *
 * @param policies 要合并的策略数组
 * @param options 合并后策略的选项（ID 和名称）
 * @returns 合并后的策略定义对象
 *
 * @example
 * ```typescript
 * const merged = mergePolicies(
 *   [policy1, policy2],
 *   { id: 'merged-policy', name: '合并策略' }
 * );
 * // 返回包含所有规则的新策略
 * ```
 */
export function mergePolicies(
  policies: PolicyDefinition[],
  options: { id: string; name: string }
): PolicyDefinition {
  // 输入验证
  if (!policies || !Array.isArray(policies) || policies.length === 0) {
    throw new Error('policies 必须是非空数组');
  }

  if (!options || typeof options !== 'object') {
    throw new Error('options 必须是对象');
  }

  if (!options.id || typeof options.id !== 'string') {
    throw new Error('options.id 必须是字符串');
  }

  if (!options.name || typeof options.name !== 'string') {
    throw new Error('options.name 必须是字符串');
  }

  // 收集所有规则
  const allRules = policies.flatMap((p, index) => {
    if (!p.rules || !Array.isArray(p.rules)) {
      throw new Error(`policies[${index}].rules 必须是数组`);
    }
    return p.rules;
  });

  // 找到最高优先级
  let maxPriority: PolicyPriority = 'low';
  for (const policy of policies) {
    const priorityValue = getPriorityValue(policy.priority);
    if (priorityValue > getPriorityValue(maxPriority)) {
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
