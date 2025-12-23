import type {
  PolicyCondition,
  PolicyDefinition,
  PolicyPriority,
  PolicyRule,
} from '../types/index.js';

/**
 * 策略规则构建器
 * 使用构建器模式创建策略规则，支持链式调用
 * 提供 fluent API 来配置规则的权限、效果、条件等
 *
 * @example
 * ```typescript
 * // 构建一个允许管理员读取用户的规则
 * const rule = rule()
 *   .permissions('user:read')
 *   .allow()
 *   .whereEquals('role', 'admin')
 *   .priority('high')
 *   .describe('允许管理员读取用户')
 *   .build();
 * ```
 */
export class PolicyRuleBuilder {
  /** 策略规则的内部状态 */
  private rule: Partial<PolicyRule> = {
    permissions: [],
    effect: 'allow',
    conditions: [],
  };

  /**
   * 设置权限列表
   * 指定该规则适用的权限，可以是具体的权限代码或通配符
   *
   * @param permissions 权限代码数组
   * @returns 规则构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * rule()
   *   .permissions('user:read', 'user:update')
   *   .allow()
   *   .build();
   * ```
   */
  permissions(...permissions: string[]): this {
    // 输入验证
    if (!permissions || permissions.length === 0) {
      throw new Error('permissions 不能为空');
    }

    for (const perm of permissions) {
      if (!perm || typeof perm !== 'string') {
        throw new Error('permissions 中的每个元素必须是字符串');
      }
    }

    this.rule.permissions = permissions;
    return this;
  }

  /**
   * 设置效果为允许（allow）
   * 当规则匹配时，允许执行指定的权限操作
   *
   * @returns 规则构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * rule()
   *   .permissions('user:read')
   *   .allow() // 设置为允许
   *   .build();
   * ```
   */
  allow(): this {
    this.rule.effect = 'allow';
    return this;
  }

  /**
   * 设置效果为拒绝（deny）
   * 当规则匹配时，拒绝执行指定的权限操作
   *
   * @returns 规则构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * rule()
   *   .permissions('user:delete')
   *   .deny() // 设置为拒绝
   *   .build();
   * ```
   */
  deny(): this {
    this.rule.effect = 'deny';
    return this;
  }

  /**
   * 添加条件
   * 只有当所有条件都满足时，规则才会生效
   *
   * @param condition 策略条件对象
   * @returns 规则构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * rule()
   *   .permissions('user:read')
   *   .allow()
   *   .when({ type: 'field', field: 'role', operator: 'eq', value: 'admin' })
   *   .build();
   * ```
   */
  when(condition: PolicyCondition): this {
    // 输入验证
    if (!condition || typeof condition !== 'object') {
      throw new Error('condition 必须是对象');
    }

    if (!condition.type || typeof condition.type !== 'string') {
      throw new Error('condition.type 必须是字符串');
    }

    this.rule.conditions = [...(this.rule.conditions ?? []), condition];
    return this;
  }

  /**
   * 添加字段等于条件
   * 便捷方法，用于添加字段等于特定值的条件
   *
   * @param field 字段名
   * @param value 要比较的值
   * @returns 规则构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * rule()
   *   .permissions('user:read')
   *   .allow()
   *   .whereEquals('role', 'admin') // 当 role 字段等于 'admin' 时
   *   .build();
   * ```
   */
  whereEquals(field: string, value: unknown): this {
    // 输入验证
    if (!field || typeof field !== 'string') {
      throw new Error('field 必须是字符串');
    }

    return this.when({ type: 'field', field, operator: 'eq', value });
  }

  /**
   * 添加字段包含条件
   * 便捷方法，用于添加字段包含特定值的条件（适用于字符串或数组）
   *
   * @param field 字段名
   * @param value 要包含的值
   * @returns 规则构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * rule()
   *   .permissions('document:read')
   *   .allow()
   *   .whereContains('tags', 'public') // 当 tags 字段包含 'public' 时
   *   .build();
   * ```
   */
  whereContains(field: string, value: unknown): this {
    // 输入验证
    if (!field || typeof field !== 'string') {
      throw new Error('field 必须是字符串');
    }

    return this.when({ type: 'field', field, operator: 'contains', value });
  }

  /**
   * 添加字段在数组中条件
   * 便捷方法，用于添加字段值在指定数组中的条件
   *
   * @param field 字段名
   * @param values 值数组
   * @returns 规则构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * rule()
   *   .permissions('order:*')
   *   .allow()
   *   .whereIn('status', ['pending', 'processing']) // 当 status 在指定数组中时
   *   .build();
   * ```
   */
  whereIn(field: string, values: unknown[]): this {
    // 输入验证
    if (!field || typeof field !== 'string') {
      throw new Error('field 必须是字符串');
    }

    if (!values || !Array.isArray(values)) {
      throw new Error('values 必须是数组');
    }

    return this.when({ type: 'field', field, operator: 'in', value: values });
  }

  /**
   * 设置优先级
   * 优先级高的规则会优先匹配
   *
   * @param priority 优先级，可选值：'low', 'normal', 'high', 'critical'
   * @returns 规则构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * rule()
   *   .permissions('user:delete')
   *   .deny()
   *   .priority('critical') // 设置为关键优先级
   *   .build();
   * ```
   */
  priority(priority: PolicyPriority): this {
    // 输入验证
    if (!priority || typeof priority !== 'string') {
      throw new Error('priority 必须是字符串');
    }

    const validPriorities = ['low', 'normal', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      throw new Error(`priority 必须是以下值之一: ${validPriorities.join(', ')}`);
    }

    this.rule.priority = priority;
    return this;
  }

  /**
   * 设置描述
   * 为规则添加描述信息，便于理解和调试
   *
   * @param description 规则描述
   * @returns 规则构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * rule()
   *   .permissions('user:read')
   *   .allow()
   *   .describe('允许管理员读取用户信息')
   *   .build();
   * ```
   */
  describe(description: string): this {
    // 输入验证
    if (!description || typeof description !== 'string') {
      throw new Error('description 必须是字符串');
    }

    this.rule.description = description;
    return this;
  }

  /**
   * 构建策略规则对象
   * 将构建器中的配置整合为完整的策略规则对象
   *
   * @returns 策略规则对象
   *
   * @throws 当权限列表为空时抛出错误
   *
   * @example
   * ```typescript
   * const rule = rule()
   *   .permissions('user:read')
   *   .allow()
   *   .whereEquals('role', 'admin')
   *   .build();
   * ```
   */
  build(): PolicyRule {
    // 验证权限不能为空
    if (!this.rule.permissions || this.rule.permissions.length === 0) {
      throw new Error('策略规则至少需要一个权限');
    }

    return {
      permissions: this.rule.permissions,
      effect: this.rule.effect ?? 'allow',
      conditions: this.rule.conditions,
      priority: this.rule.priority,
      description: this.rule.description,
    };
  }
}

/**
 * 策略构建器
 * 使用构建器模式创建策略定义，支持链式调用
 * 提供 fluent API 来配置策略的名称、描述、优先级、规则等
 *
 * @example
 * ```typescript
 * // 构建一个完整的策略
 * const myPolicy = policy('my-policy')
 *   .name('我的策略')
 *   .description('策略描述')
 *   .priority('high')
 *   .enable()
 *   .forTenant('tenant-123')
 *   .rule(rule()
 *     .permissions('user:read', 'user:update')
 *     .allow()
 *     .whereEquals('role', 'admin'))
 *   .rule(rule()
 *     .permissions('user:delete')
 *     .deny()
 *     .priority('critical'))
 *   .metadata({ createdBy: 'admin' })
 *   .build();
 * ```
 */
export class PolicyBuilder {
  /** 策略的内部状态 */
  private policy: Partial<PolicyDefinition> = {
    rules: [],
    priority: 'normal',
    enabled: true,
  };

  /**
   * 创建策略构建器
   * @param id 策略ID，必须唯一
   */
  constructor(id: string) {
    // 输入验证
    if (!id || typeof id !== 'string') {
      throw new Error('id 必须是字符串');
    }

    this.policy.id = id;
    this.policy.name = id;
  }

  /**
   * 设置策略名称
   * 策略的人类可读名称，用于显示和识别
   *
   * @param name 策略名称
   * @returns 策略构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * policy('my-policy')
   *   .name('我的用户管理策略')
   *   .build();
   * ```
   */
  name(name: string): this {
    // 输入验证
    if (!name || typeof name !== 'string') {
      throw new Error('name 必须是字符串');
    }

    this.policy.name = name;
    return this;
  }

  /**
   * 设置策略描述
   * 策略的详细描述，说明其作用和适用范围
   *
   * @param description 策略描述
   * @returns 策略构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * policy('my-policy')
   *   .description('该策略用于控制管理员对用户资源的访问权限')
   *   .build();
   * ```
   */
  description(description: string): this {
    // 输入验证
    if (!description || typeof description !== 'string') {
      throw new Error('description 必须是字符串');
    }

    this.policy.description = description;
    return this;
  }

  /**
   * 设置策略优先级
   * 优先级高的策略会优先匹配
   *
   * @param priority 优先级，可选值：'low', 'normal', 'high', 'critical'
   * @returns 策略构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * policy('security-policy')
   *   .priority('critical') // 安全策略设为关键优先级
   *   .build();
   * ```
   */
  priority(priority: PolicyPriority): this {
    // 输入验证
    if (!priority || typeof priority !== 'string') {
      throw new Error('priority 必须是字符串');
    }

    const validPriorities = ['low', 'normal', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      throw new Error(`priority 必须是以下值之一: ${validPriorities.join(', ')}`);
    }

    this.policy.priority = priority;
    return this;
  }

  /**
   * 启用策略
   * 设置策略为启用状态，策略会被执行
   *
   * @returns 策略构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * policy('my-policy')
   *   .enable() // 启用策略
   *   .build();
   * ```
   */
  enable(): this {
    this.policy.enabled = true;
    return this;
  }

  /**
   * 禁用策略
   * 设置策略为禁用状态，策略不会被执行
   *
   * @returns 策略构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * policy('my-policy')
   *   .disable() // 禁用策略
   *   .build();
   * ```
   */
  disable(): this {
    this.policy.enabled = false;
    return this;
  }

  /**
   * 设置租户ID
   * 指定策略适用的租户，如果未设置则适用于所有租户
   *
   * @param tenantId 租户ID
   * @returns 策略构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * policy('tenant-policy')
   *   .forTenant('tenant-123') // 仅适用于租户 tenant-123
   *   .build();
   * ```
   */
  forTenant(tenantId: string): this {
    // 输入验证
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('tenantId 必须是字符串');
    }

    this.policy.tenantId = tenantId;
    return this;
  }

  /**
   * 添加策略规则
   * 向策略中添加一个已构建的策略规则
   *
   * @param rule 策略规则对象
   * @returns 策略构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * const rule = rule().permissions('user:read').allow().build();
   * policy('my-policy')
   *   .addRule(rule)
   *   .build();
   * ```
   */
  addRule(rule: PolicyRule): this {
    // 输入验证
    if (!rule || typeof rule !== 'object') {
      throw new Error('rule 必须是对象');
    }

    if (!rule.permissions || !Array.isArray(rule.permissions) || rule.permissions.length === 0) {
      throw new Error('rule.permissions 必须是非空数组');
    }

    if (!rule.effect || (rule.effect !== 'allow' && rule.effect !== 'deny')) {
      throw new Error('rule.effect 必须是 "allow" 或 "deny"');
    }

    this.policy.rules = [...(this.policy.rules ?? []), rule];
    return this;
  }

  /**
   * 使用构建器添加规则
   * 通过回调函数使用规则构建器创建规则
   *
   * @param builder 规则构建器回调函数
   * @returns 策略构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * policy('my-policy')
   *   .rule(ruleBuilder => ruleBuilder
   *     .permissions('user:read')
   *     .allow()
   *     .whereEquals('role', 'admin'))
   *   .build();
   * ```
   */
  rule(builder: (rb: PolicyRuleBuilder) => PolicyRuleBuilder): this {
    // 输入验证
    if (typeof builder !== 'function') {
      throw new Error('builder 必须是函数');
    }

    const ruleBuilder = new PolicyRuleBuilder();
    const rule = builder(ruleBuilder).build();
    return this.addRule(rule);
  }

  /**
   * 快速添加允许权限规则
   * 便捷方法，直接创建允许指定权限的规则
   *
   * @param permissions 权限代码数组
   * @returns 策略构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * policy('my-policy')
   *   .allow('user:read', 'user:update') // 快速添加允许规则
   *   .build();
   * ```
   */
  allow(...permissions: string[]): this {
    // 输入验证
    if (!permissions || permissions.length === 0) {
      throw new Error('permissions 不能为空');
    }

    for (const perm of permissions) {
      if (!perm || typeof perm !== 'string') {
        throw new Error('permissions 中的每个元素必须是字符串');
      }
    }

    return this.addRule({
      permissions,
      effect: 'allow',
    });
  }

  /**
   * 快速添加拒绝权限规则
   * 便捷方法，直接创建拒绝指定权限的规则
   *
   * @param permissions 权限代码数组
   * @returns 策略构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * policy('my-policy')
   *   .deny('user:delete') // 快速添加拒绝规则
   *   .build();
   * ```
   */
  deny(...permissions: string[]): this {
    // 输入验证
    if (!permissions || permissions.length === 0) {
      throw new Error('permissions 不能为空');
    }

    for (const perm of permissions) {
      if (!perm || typeof perm !== 'string') {
        throw new Error('permissions 中的每个元素必须是字符串');
      }
    }

    return this.addRule({
      permissions,
      effect: 'deny',
    });
  }

  /**
   * 设置元数据
   * 为策略添加自定义元数据信息
   *
   * @param metadata 元数据对象
   * @returns 策略构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * policy('my-policy')
   *   .metadata({
   *     createdBy: 'admin',
   *     createdAt: '2024-01-01',
   *     version: '1.0.0'
   *   })
   *   .build();
   * ```
   */
  metadata(metadata: Record<string, unknown>): this {
    // 输入验证
    if (!metadata || typeof metadata !== 'object') {
      throw new Error('metadata 必须是对象');
    }

    this.policy.metadata = { ...this.policy.metadata, ...metadata };
    return this;
  }

  /**
   * 构建策略对象
   * 将构建器中的配置整合为完整的策略对象
   *
   * @returns 策略定义对象
   *
   * @throws 当策略ID为空时抛出错误
   *
   * @example
   * ```typescript
   * const policy = policy('my-policy')
   *   .name('我的策略')
   *   .allow('user:read')
   *   .build();
   * ```
   */
  build(): PolicyDefinition {
    // 验证策略ID不能为空
    if (!this.policy.id) {
      throw new Error('策略必须有ID');
    }

    return {
      id: this.policy.id,
      name: this.policy.name ?? this.policy.id,
      description: this.policy.description,
      rules: this.policy.rules ?? [],
      priority: this.policy.priority ?? 'normal',
      enabled: this.policy.enabled ?? true,
      tenantId: this.policy.tenantId,
      metadata: this.policy.metadata,
    };
  }
}

/**
 * 创建策略构建器
 * 便捷工厂函数，用于快速创建策略构建器实例
 *
 * @param id 策略ID，必须唯一
 * @returns 策略构建器实例
 *
 * @example
 * ```typescript
 * const builder = policy('my-policy');
 * const myPolicy = builder
 *   .name('我的策略')
 *   .allow('user:read')
 *   .build();
 * ```
 */
export function policy(id: string): PolicyBuilder {
  // 输入验证
  if (!id || typeof id !== 'string') {
    throw new Error('id 必须是字符串');
  }

  return new PolicyBuilder(id);
}

/**
 * 创建策略规则构建器
 * 便捷工厂函数，用于快速创建策略规则构建器实例
 *
 * @returns 策略规则构建器实例
 *
 * @example
 * ```typescript
 * const ruleBuilder = rule();
 * const myRule = ruleBuilder
 *   .permissions('user:read')
 *   .allow()
 *   .whereEquals('role', 'admin')
 *   .build();
 * ```
 */
export function rule(): PolicyRuleBuilder {
  return new PolicyRuleBuilder();
}

/**
 * 快速创建允许策略
 * 便捷函数，用于快速创建一个简单的允许策略
 *
 * @param id 策略ID
 * @param permissions 权限列表
 * @param tenantId 可选的租户ID
 * @returns 策略定义对象
 *
 * @example
 * ```typescript
 * // 创建一个允许读取和更新用户的策略
 * const allowPolicy = allowPolicy(
 *   'user-read-update',
 *   ['user:read', 'user:update']
 * );
 * ```
 */
export function allowPolicy(
  id: string,
  permissions: string[],
  tenantId?: string
): PolicyDefinition {
  // 输入验证
  if (!id || typeof id !== 'string') {
    throw new Error('id 必须是字符串');
  }

  if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
    throw new Error('permissions 必须是非空数组');
  }

  for (const perm of permissions) {
    if (!perm || typeof perm !== 'string') {
      throw new Error('permissions 中的每个元素必须是字符串');
    }
  }

  if (tenantId && typeof tenantId !== 'string') {
    throw new Error('tenantId 必须是字符串');
  }

  return policy(id)
    .allow(...permissions)
    .forTenant(tenantId ?? '')
    .build();
}

/**
 * 快速创建拒绝策略
 * 便捷函数，用于快速创建一个关键的拒绝策略
 * 默认优先级为 'critical'，确保拒绝规则优先执行
 *
 * @param id 策略ID
 * @param permissions 权限列表
 * @param tenantId 可选的租户ID
 * @returns 策略定义对象
 *
 * @example
 * ```typescript
 * // 创建一个拒绝删除用户的策略（关键优先级）
 * const denyPolicy = denyPolicy(
 *   'user-delete-deny',
 *   ['user:delete']
 * );
 * ```
 */
export function denyPolicy(id: string, permissions: string[], tenantId?: string): PolicyDefinition {
  // 输入验证
  if (!id || typeof id !== 'string') {
    throw new Error('id 必须是字符串');
  }

  if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
    throw new Error('permissions 必须是非空数组');
  }

  for (const perm of permissions) {
    if (!perm || typeof perm !== 'string') {
      throw new Error('permissions 中的每个元素必须是字符串');
    }
  }

  if (tenantId && typeof tenantId !== 'string') {
    throw new Error('tenantId 必须是字符串');
  }

  return policy(id)
    .deny(...permissions)
    .priority('critical') // 拒绝策略使用关键优先级
    .forTenant(tenantId ?? '')
    .build();
}
