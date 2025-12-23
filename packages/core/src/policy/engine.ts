import type {
  CompiledPolicy,
  PolicyDefinition,
  PolicyEngine,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
} from '../types/index.js';
import { compilePolicy } from './compiler.js';

/**
 * 默认策略引擎实现
 * 负责策略的存储、编译、排序和评估
 * 支持多租户策略，按优先级排序，快速评估
 *
 * @example
 * ```typescript
 * const engine = createPolicyEngine();
 *
 * // 添加策略
 * engine.addPolicy(myPolicy);
 *
 * // 评估策略
 * const result = await engine.evaluate({
 *   tenant: { id: 'tenant-1' },
 *   subject: { id: 'user-1', attributes: { role: 'admin' } },
 *   permission: { code: 'user:read', resource: 'user', action: 'read' },
 *   resource: {}
 * });
 *
 * if (result.effect === 'allow') {
 *   // 允许访问
 * } else {
 *   // 拒绝访问
 * }
 * ```
 */
export class DefaultPolicyEngine implements PolicyEngine {
  /** 策略定义映射：策略ID -> 策略定义 */
  private policies: Map<string, PolicyDefinition> = new Map();

  /** 编译后策略映射：策略ID -> 编译后策略 */
  private compiledPolicies: Map<string, CompiledPolicy> = new Map();

  /** 已排序的编译策略列表，按优先级降序排列 */
  private sortedPolicies: CompiledPolicy[] = [];

  /** 是否需要重新排序标志 */
  private needsSort = false;

  /**
   * 评估策略
   * 根据评估上下文，按优先级顺序检查所有适用策略
   * 找到第一个匹配的规则时立即返回结果（短路评估）
   *
   * @param context 策略评估上下文，包含租户、主体、权限和资源信息
   * @returns 策略评估结果，包含效果、匹配的策略和规则、条件等
   *
   * @example
   * ```typescript
   * const result = await engine.evaluate({
   *   tenant: { id: 'tenant-1' },
   *   subject: { id: 'user-1', attributes: { role: 'admin' } },
   *   permission: { code: 'user:read', resource: 'user', action: 'read' },
   *   resource: {}
   * });
   *
   * console.log(result.effect); // 'allow' 或 'deny'
   * console.log(result.matchedPolicy); // 匹配的策略ID
   * console.log(result.evaluationPath); // 评估路径
   * ```
   */
  async evaluate(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
    // 输入验证
    if (!context || typeof context !== 'object') {
      throw new Error('context 必须是对象');
    }

    if (!context.tenant || typeof context.tenant.id !== 'string') {
      throw new Error('context.tenant.id 必须是字符串');
    }

    if (!context.subject || typeof context.subject.id !== 'string') {
      throw new Error('context.subject.id 必须是字符串');
    }

    if (!context.permission || typeof context.permission.code !== 'string') {
      throw new Error('context.permission.code 必须是字符串');
    }

    // 如果需要排序，先排序
    if (this.needsSort) {
      this.sortPolicies();
    }

    const evaluationPath: string[] = [];

    // 获取适用于该租户的策略
    const applicablePolicies = this.getApplicablePolicies(context.tenant.id);

    // 遍历所有适用策略
    for (const policy of applicablePolicies) {
      // 跳过禁用的策略
      if (!policy.enabled) {
        continue;
      }

      // 记录评估路径
      evaluationPath.push(`policy:${policy.id}`);

      // 遍历策略中的所有规则
      for (let i = 0; i < policy.rules.length; i++) {
        const rule = policy.rules[i];

        // 检查规则是否适用于当前权限（支持通配符）
        const permissionCode = context.permission.code;
        const resourceWildcard = `${context.permission.resource}:*`;

        if (
          !rule.permissions.has(permissionCode) &&
          !rule.permissions.has('*') &&
          !rule.permissions.has(resourceWildcard)
        ) {
          continue;
        }

        // 记录评估路径
        evaluationPath.push(`rule:${i}`);

        // 评估条件
        const conditionsPassed: typeof rule.conditions = [];
        const conditionsFailed: typeof rule.conditions = [];
        let allConditionsMet = true;

        // 逐个评估条件（短路评估）
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

        // 如果没有条件或所有条件都满足，应用规则效果
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

    // 默认拒绝（如果没有匹配的策略）
    return {
      effect: 'deny',
      evaluationPath,
    };
  }

  /**
   * 添加策略
   * 将策略添加到引擎中并编译优化
   *
   * @param policy 策略定义对象
   *
   * @example
   * ```typescript
   * engine.addPolicy({
   *   id: 'my-policy',
   *   name: '我的策略',
   *   rules: [...],
   *   priority: 'normal',
   *   enabled: true
   * });
   * ```
   */
  addPolicy(policy: PolicyDefinition): void {
    // 输入验证
    if (!policy || typeof policy !== 'object') {
      throw new Error('policy 必须是对象');
    }

    if (!policy.id || typeof policy.id !== 'string') {
      throw new Error('policy.id 必须是字符串');
    }

    // 检查策略是否已存在
    if (this.policies.has(policy.id)) {
      throw new Error(`策略已存在: ${policy.id}`);
    }

    this.policies.set(policy.id, policy);
    this.compiledPolicies.set(policy.id, compilePolicy(policy));
    this.needsSort = true;
  }

  /**
   * 移除策略
   * 从引擎中删除指定策略
   *
   * @param policyId 要删除的策略ID
   *
   * @example
   * ```typescript
   * engine.removePolicy('my-policy');
   * ```
   */
  removePolicy(policyId: string): void {
    // 输入验证
    if (!policyId || typeof policyId !== 'string') {
      throw new Error('policyId 必须是字符串');
    }

    this.policies.delete(policyId);
    this.compiledPolicies.delete(policyId);
    this.needsSort = true;
  }

  /**
   * 根据ID获取策略
   *
   * @param policyId 策略ID
   * @returns 策略定义对象，如果不存在则返回 undefined
   *
   * @example
   * ```typescript
   * const policy = engine.getPolicy('my-policy');
   * if (policy) {
   *   console.log(`找到策略: ${policy.name}`);
   * }
   * ```
   */
  getPolicy(policyId: string): PolicyDefinition | undefined {
    // 输入验证
    if (!policyId || typeof policyId !== 'string') {
      throw new Error('policyId 必须是字符串');
    }

    return this.policies.get(policyId);
  }

  /**
   * 列出所有策略
   * 可选择按租户ID过滤
   *
   * @param tenantId 可选的租户ID，用于过滤策略
   * @returns 策略定义数组
   *
   * @example
   * ```typescript
   * // 获取所有策略
   * const allPolicies = engine.listPolicies();
   *
   * // 获取指定租户的策略
   * const tenantPolicies = engine.listPolicies('tenant-123');
   * ```
   */
  listPolicies(tenantId?: string): PolicyDefinition[] {
    const policies = Array.from(this.policies.values());

    if (tenantId) {
      // 输入验证
      if (typeof tenantId !== 'string') {
        throw new Error('tenantId 必须是字符串');
      }
      return policies.filter(p => !p.tenantId || p.tenantId === tenantId);
    }

    return policies;
  }

  /**
   * 编译策略
   * 将策略定义转换为编译后的格式（不添加到引擎中）
   *
   * @param policy 策略定义对象
   * @returns 编译后的策略对象
   *
   * @example
   * ```typescript
   * const compiled = engine.compile(myPolicy);
   * console.log(`编译后的策略优先级: ${compiled.priority}`);
   * ```
   */
  compile(policy: PolicyDefinition): CompiledPolicy {
    // 输入验证
    if (!policy || typeof policy !== 'object') {
      throw new Error('policy 必须是对象');
    }

    if (!policy.id || typeof policy.id !== 'string') {
      throw new Error('policy.id 必须是字符串');
    }

    return compilePolicy(policy);
  }

  /**
   * 获取适用于指定租户的策略
   * 从已排序的策略列表中过滤出适用于指定租户的策略
   *
   * @param tenantId 租户ID
   * @returns 适用于该租户的编译策略数组
   *
   * @private
   */
  private getApplicablePolicies(tenantId: string): CompiledPolicy[] {
    // 输入验证
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('tenantId 必须是字符串');
    }

    return this.sortedPolicies.filter(p => !p.tenantId || p.tenantId === tenantId);
  }

  /**
   * 按优先级排序策略
   * 将编译后的策略按优先级降序排列
   *
   * @private
   */
  private sortPolicies(): void {
    this.sortedPolicies = Array.from(this.compiledPolicies.values()).sort(
      (a, b) => b.priority - a.priority
    );
    this.needsSort = false;
  }

  /**
   * 清空所有策略
   * 从引擎中删除所有策略并重置状态
   *
   * @example
   * ```typescript
   * engine.clear(); // 清空所有策略
   * ```
   */
  clear(): void {
    this.policies.clear();
    this.compiledPolicies.clear();
    this.sortedPolicies = [];
    this.needsSort = false;
  }
}

/**
 * 创建策略引擎
 * 便捷工厂函数，用于创建默认的策略引擎实例
 *
 * @returns 策略引擎实例
 *
 * @example
 * ```typescript
 * const engine = createPolicyEngine();
 *
 * // 添加策略
 * engine.addPolicy(myPolicy);
 *
 * // 评估策略
 * const result = await engine.evaluate(context);
 * ```
 */
export function createPolicyEngine(): PolicyEngine {
  return new DefaultPolicyEngine();
}
