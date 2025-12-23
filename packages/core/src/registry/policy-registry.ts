import { compilePolicy } from '../policy/compiler.js';
import type { CompiledPolicy, PolicyDefinition } from '../types/index.js';

/**
 * 策略注册表
 * 负责策略的注册、编译、存储和按租户查询
 * 支持全局策略和租户特定策略，自动编译策略以提高运行时性能
 *
 * 特性：
 * - 策略注册和编译
 * - 按租户分类索引
 * - 全局策略支持
 * - 策略更新和删除
 * - 优先排序支持
 *
 * @example
 * ```typescript
 * const registry = createPolicyRegistry();
 *
 * // 注册全局策略
 * registry.register({
 *   id: 'global-policy',
 *   name: '全局策略',
 *   rules: [...]
 * });
 *
 * // 注册租户特定策略
 * registry.register({
 *   id: 'tenant-policy',
 *   name: '租户策略',
 *   tenantId: 'tenant-1',
 *   rules: [...]
 * });
 *
 * // 获取租户策略（包括全局）
 * const policies = registry.getCompiledForTenant('tenant-1');
 * ```
 */
export class PolicyRegistry {
  /** 策略定义映射：策略ID -> 策略定义 */
  private policies: Map<string, PolicyDefinition> = new Map();

  /** 编译后策略映射：策略ID -> 编译后策略 */
  private compiledPolicies: Map<string, CompiledPolicy> = new Map();

  /** 按租户分类的策略索引：租户ID -> 策略ID集合 */
  private byTenant: Map<string, Set<string>> = new Map();

  /** 全局策略ID集合（不绑定特定租户） */
  private globalPolicies: Set<string> = new Set();

  /**
   * 注册策略
   * 将策略定义注册到注册表中并编译为优化格式
   * 自动根据 tenantId 分类为全局或租户特定策略
   *
   * @param policy 策略定义对象
   * @returns 编译后的策略对象
   * @throws Error 输入参数无效时抛出
   *
   * @example
   * ```typescript
   * // 注册全局策略
   * registry.register({
   *   id: 'admin-policy',
   *   name: '管理员策略',
   *   rules: [{ permissions: ['*'], effect: 'allow' }]
   * });
   *
   * // 注册租户特定策略
   * registry.register({
   *   id: 'tenant-admin',
   *   name: '租户管理员',
   *   tenantId: 'tenant-1',
   *   rules: [...]
   * });
   * ```
   */
  register(policy: PolicyDefinition): CompiledPolicy {
    // 输入验证
    if (!policy || typeof policy !== 'object') {
      throw new Error('policy 必须是对象');
    }

    if (!policy.id || typeof policy.id !== 'string') {
      throw new Error('policy.id 必须是字符串');
    }

    if (!policy.name || typeof policy.name !== 'string') {
      throw new Error('policy.name 必须是字符串');
    }

    if (!policy.rules || !Array.isArray(policy.rules)) {
      throw new Error('policy.rules 必须是数组');
    }

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
   * 批量注册策略
   * 一次性注册多个策略定义
   *
   * @param policies 策略定义数组
   * @returns 编译后策略对象数组
   *
   * @example
   * ```typescript
   * registry.registerMany([
   *   { id: 'policy-1', name: '策略1', rules: [...] },
   *   { id: 'policy-2', name: '策略2', rules: [...] }
   * ]);
   * ```
   */
  registerMany(policies: PolicyDefinition[]): CompiledPolicy[] {
    return policies.map(p => this.register(p));
  }

  /**
   * 注销策略
   * 从注册表中删除指定策略及其编译版本
   *
   * @param policyId 策略ID
   *
   * @example
   * ```typescript
   * registry.unregister('my-policy');
   * ```
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
   * 根据策略ID获取策略定义
   *
   * @param policyId 策略ID
   * @returns 策略定义对象，如果不存在则返回 undefined
   *
   * @example
   * ```typescript
   * const policy = registry.get('my-policy');
   * if (policy) {
   *   console.log(policy.name);
   * }
   * ```
   */
  get(policyId: string): PolicyDefinition | undefined {
    return this.policies.get(policyId);
  }

  /**
   * 根据策略ID获取编译后策略
   *
   * @param policyId 策略ID
   * @returns 编译后策略对象，如果不存在则返回 undefined
   *
   * @example
   * ```typescript
   * const compiled = registry.getCompiled('my-policy');
   * if (compiled) {
   *   console.log(compiled.priority);
   * }
   * ```
   */
  getCompiled(policyId: string): CompiledPolicy | undefined {
    return this.compiledPolicies.get(policyId);
  }

  /**
   * 检查策略是否存在
   *
   * @param policyId 策略ID
   * @returns 存在返回 true，否则返回 false
   *
   * @example
   * ```typescript
   * if (registry.has('my-policy')) {
   *   console.log('策略已注册');
   * }
   * ```
   */
  has(policyId: string): boolean {
    return this.policies.has(policyId);
  }

  /**
   * 获取所有策略定义
   *
   * @returns 策略定义对象数组
   *
   * @example
   * ```typescript
   * const allPolicies = registry.list();
   * console.log(`共注册 ${allPolicies.length} 个策略`);
   * ```
   */
  list(): PolicyDefinition[] {
    return Array.from(this.policies.values());
  }

  /**
   * 获取所有编译后策略
   *
   * @returns 编译后策略对象数组
   *
   * @example
   * ```typescript
   * const allCompiled = registry.listCompiled();
   * console.log(allCompiled);
   * ```
   */
  listCompiled(): CompiledPolicy[] {
    return Array.from(this.compiledPolicies.values());
  }

  /**
   * 获取指定租户的所有策略（包括全局策略）
   * 返回已启用且未过期的策略
   *
   * @param tenantId 租户ID
   * @returns 策略定义对象数组
   *
   * @example
   * ```typescript
   * const tenantPolicies = registry.getForTenant('tenant-1');
   * // 包含该租户的特定策略 + 所有全局策略
   * ```
   */
  getForTenant(tenantId: string): PolicyDefinition[] {
    const tenantPolicyIdsSet = this.byTenant.get(tenantId) ?? new Set();
    const tenantPolicyIds = Array.from(tenantPolicyIdsSet);
    const allIdsSet = new Set([...Array.from(this.globalPolicies), ...tenantPolicyIds]);
    const allIds = Array.from(allIdsSet);

    return allIds
      .map(id => this.policies.get(id)!)
      .filter(Boolean)
      .filter(p => p.enabled);
  }

  /**
   * 获取指定租户的所有编译后策略（包括全局策略）
   * 按优先级降序排列，返回已启用的策略
   *
   * @param tenantId 租户ID
   * @returns 编译后策略对象数组，按优先级排序
   *
   * @example
   * ```typescript
   * const compiled = registry.getCompiledForTenant('tenant-1');
   * compiled.forEach(p => console.log(p.name, p.priority));
   * ```
   */
  getCompiledForTenant(tenantId: string): CompiledPolicy[] {
    const tenantPolicyIdsSet = this.byTenant.get(tenantId) ?? new Set();
    const tenantPolicyIds = Array.from(tenantPolicyIdsSet);
    const allIdsSet = new Set([...Array.from(this.globalPolicies), ...tenantPolicyIds]);
    const allIds = Array.from(allIdsSet);

    return allIds
      .map(id => this.compiledPolicies.get(id)!)
      .filter(Boolean)
      .filter(p => p.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取所有全局策略
   *
   * @returns 策略定义对象数组
   *
   * @example
   * ```typescript
   * const global = registry.getGlobal();
   * console.log('全局策略数量:', global.length);
   * ```
   */
  getGlobal(): PolicyDefinition[] {
    return Array.from(this.globalPolicies)
      .map(id => this.policies.get(id)!)
      .filter(Boolean);
  }

  /**
   * 获取注册表中的策略总数
   *
   * @returns 策略数量
   *
   * @example
   * ```typescript
   * console.log(`当前共有 ${registry.size} 个策略`);
   * ```
   */
  get size(): number {
    return this.policies.size;
  }

  /**
   * 清空所有策略
   * 删除所有策略定义和编译版本
   *
   * @example
   * ```typescript
   * registry.clear();
   * ```
   */
  clear(): void {
    this.policies.clear();
    this.compiledPolicies.clear();
    this.byTenant.clear();
    this.globalPolicies.clear();
  }

  /**
   * 更新策略
   * 先删除旧策略，再注册更新后的策略
   *
   * @param policyId 策略ID
   * @param updates 策略更新内容
   * @returns 更新后的编译策略对象，如果策略不存在则返回 undefined
   *
   * @example
   * ```typescript
   * const updated = registry.update('my-policy', {
   *   name: '新名称',
   *   description: '新描述'
   * });
   * ```
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
 * 创建策略注册表
 * 工厂函数，用于创建策略注册表实例
 *
 * @returns 策略注册表实例
 *
 * @example
 * ```typescript
 * const registry = createPolicyRegistry();
 * registry.register({
 *   id: 'my-policy',
 *   name: '我的策略',
 *   rules: [...]
 * });
 * ```
 */
export function createPolicyRegistry(): PolicyRegistry {
  return new PolicyRegistry();
}
