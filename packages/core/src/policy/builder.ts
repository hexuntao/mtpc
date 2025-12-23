import type {
  PolicyCondition,
  PolicyDefinition,
  PolicyEffect,
  PolicyPriority,
  PolicyRule,
} from '../types/index.js';

/**
 * Policy rule builder
 */
export class PolicyRuleBuilder {
  private rule: Partial<PolicyRule> = {
    permissions: [],
    effect: 'allow',
    conditions: [],
  };

  /**
   * Set permissions
   */
  permissions(...permissions: string[]): this {
    this.rule.permissions = permissions;
    return this;
  }

  /**
   * Set effect to allow
   */
  allow(): this {
    this.rule.effect = 'allow';
    return this;
  }

  /**
   * Set effect to deny
   */
  deny(): this {
    this.rule.effect = 'deny';
    return this;
  }

  /**
   * Add condition
   */
  when(condition: PolicyCondition): this {
    this.rule.conditions = [...(this.rule.conditions ?? []), condition];
    return this;
  }

  /**
   * Add field equality condition
   */
  whereEquals(field: string, value: unknown): this {
    return this.when({ type: 'field', field, operator: 'eq', value });
  }

  /**
   * Add field contains condition
   */
  whereContains(field: string, value: unknown): this {
    return this.when({ type: 'field', field, operator: 'contains', value });
  }

  /**
   * Add field in array condition
   */
  whereIn(field: string, values: unknown[]): this {
    return this.when({ type: 'field', field, operator: 'in', value: values });
  }

  /**
   * Set priority
   */
  priority(priority: PolicyPriority): this {
    this.rule.priority = priority;
    return this;
  }

  /**
   * Set description
   */
  describe(description: string): this {
    this.rule.description = description;
    return this;
  }

  /**
   * Build the rule
   */
  build(): PolicyRule {
    if (!this.rule.permissions || this.rule.permissions.length === 0) {
      throw new Error('Policy rule must have at least one permission');
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
 * Policy builder
 */
export class PolicyBuilder {
  private policy: Partial<PolicyDefinition> = {
    rules: [],
    priority: 'normal',
    enabled: true,
  };

  constructor(id: string) {
    this.policy.id = id;
    this.policy.name = id;
  }

  /**
   * Set policy name
   */
  name(name: string): this {
    this.policy.name = name;
    return this;
  }

  /**
   * Set description
   */
  description(description: string): this {
    this.policy.description = description;
    return this;
  }

  /**
   * Set priority
   */
  priority(priority: PolicyPriority): this {
    this.policy.priority = priority;
    return this;
  }

  /**
   * Enable policy
   */
  enable(): this {
    this.policy.enabled = true;
    return this;
  }

  /**
   * Disable policy
   */
  disable(): this {
    this.policy.enabled = false;
    return this;
  }

  /**
   * Set tenant
   */
  forTenant(tenantId: string): this {
    this.policy.tenantId = tenantId;
    return this;
  }

  /**
   * Add rule
   */
  addRule(rule: PolicyRule): this {
    this.policy.rules = [...(this.policy.rules ?? []), rule];
    return this;
  }

  /**
   * Add rule using builder
   */
  rule(builder: (rb: PolicyRuleBuilder) => PolicyRuleBuilder): this {
    const ruleBuilder = new PolicyRuleBuilder();
    const rule = builder(ruleBuilder).build();
    return this.addRule(rule);
  }

  /**
   * Allow permissions
   */
  allow(...permissions: string[]): this {
    return this.addRule({
      permissions,
      effect: 'allow',
    });
  }

  /**
   * Deny permissions
   */
  deny(...permissions: string[]): this {
    return this.addRule({
      permissions,
      effect: 'deny',
    });
  }

  /**
   * Set metadata
   */
  metadata(metadata: Record<string, unknown>): this {
    this.policy.metadata = { ...this.policy.metadata, ...metadata };
    return this;
  }

  /**
   * Build the policy
   */
  build(): PolicyDefinition {
    if (!this.policy.id) {
      throw new Error('Policy must have an ID');
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
 * Create a policy builder
 */
export function policy(id: string): PolicyBuilder {
  return new PolicyBuilder(id);
}

/**
 * Create a policy rule builder
 */
export function rule(): PolicyRuleBuilder {
  return new PolicyRuleBuilder();
}

/**
 * Quick allow policy
 */
export function allowPolicy(
  id: string,
  permissions: string[],
  tenantId?: string
): PolicyDefinition {
  return policy(id)
    .allow(...permissions)
    .forTenant(tenantId ?? '')
    .build();
}

/**
 * Quick deny policy
 */
export function denyPolicy(id: string, permissions: string[], tenantId?: string): PolicyDefinition {
  return policy(id)
    .deny(...permissions)
    .priority('critical')
    .forTenant(tenantId ?? '')
    .build();
}
