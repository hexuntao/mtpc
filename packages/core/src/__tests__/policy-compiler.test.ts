import { describe, it, expect, beforeEach } from 'vitest';
import { compilePolicy, compilePolicies, mergePolicies, getPriorityValue } from '../policy/compiler.js';
import type { PolicyDefinition } from '../types/index.js';

describe('Policy Compiler', () => {
  describe('getPriorityValue', () => {
    it('should return correct numeric values for priorities', () => {
      expect(getPriorityValue('low')).toBe(10);
      expect(getPriorityValue('normal')).toBe(50);
      expect(getPriorityValue('high')).toBe(100);
      expect(getPriorityValue('critical')).toBe(1000);
    });

    it('should return normal priority for unknown values', () => {
      expect(getPriorityValue('unknown' as any)).toBe(50);
    });
  });

  describe('compilePolicy - input validation', () => {
    it('should throw for null policy', () => {
      expect(() => compilePolicy(null as any)).toThrow('policy 必须是对象');
    });

    it('should throw for non-object policy', () => {
      expect(() => compilePolicy('invalid' as any)).toThrow('policy 必须是对象');
    });

    it('should throw for missing policy.id', () => {
      expect(() => compilePolicy({ name: 'Test' } as any)).toThrow('policy.id 必须是字符串');
    });

    it('should throw for non-string policy.id', () => {
      expect(() => compilePolicy({ id: 123 } as any)).toThrow('policy.id 必须是字符串');
    });

    it('should throw for missing policy.rules', () => {
      expect(() => compilePolicy({ id: 'test' } as any)).toThrow('policy.rules 必须是数组');
    });

    it('should throw for non-array policy.rules', () => {
      expect(() => compilePolicy({ id: 'test', rules: {} } as any)).toThrow('policy.rules 必须是数组');
    });

    it('should handle empty rules array', () => {
      const policy = { id: 'test', rules: [] } as PolicyDefinition;
      // Empty rules array - the check is on each rule's permissions being non-empty
      // So an empty rules array won't throw here (it passes the empty check on rules array itself)
      const compiled = compilePolicy(policy);
      expect(compiled.rules).toHaveLength(0);
    });

    it('should throw for invalid rule permissions', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [{ permissions: null as any, effect: 'allow', conditions: [] }],
      };
      expect(() => compilePolicy(policy)).toThrow('permissions 必须是非空数组');
    });

    it('should throw for non-array rule.permissions', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [{ permissions: 'read' as any, effect: 'allow', conditions: [] }],
      };
      expect(() => compilePolicy(policy)).toThrow('permissions 必须是非空数组');
    });

    it('should throw for invalid rule.effect', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [{ permissions: ['read'], effect: 'invalid' as any, conditions: [] }],
      };
      expect(() => compilePolicy(policy)).toThrow('effect 必须是 "allow" 或 "deny"');
    });
  });

  describe('compilePolicy - basic compilation', () => {
    it('should compile a valid policy', () => {
      const policy: PolicyDefinition = {
        id: 'test-policy',
        name: 'Test Policy',
        rules: [
          {
            permissions: ['user:read'],
            effect: 'allow',
            conditions: [],
          },
        ],
        priority: 'normal',
        enabled: true,
      };

      const compiled = compilePolicy(policy);

      expect(compiled.id).toBe('test-policy');
      expect(compiled.name).toBe('Test Policy');
      expect(compiled.enabled).toBe(true);
      expect(compiled.priority).toBe(50);
      expect(compiled.rules).toHaveLength(1);
    });

    it('should convert permissions to Set', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [{ permissions: ['user:read', 'user:write'], effect: 'allow', conditions: [] }],
      };

      const compiled = compilePolicy(policy);
      const rule = compiled.rules[0];

      expect(rule.permissions).toBeInstanceOf(Set);
      expect(rule.permissions.has('user:read')).toBe(true);
      expect(rule.permissions.has('user:write')).toBe(true);
    });

    it('should preserve rule conditions', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [
          {
            permissions: ['user:read'],
            effect: 'allow',
            conditions: [{ type: 'field', field: 'subject.role', operator: 'eq', value: 'admin' }],
          },
        ],
      };

      const compiled = compilePolicy(policy);
      expect(compiled.rules[0].conditions).toHaveLength(1);
      expect(compiled.rules[0].conditions[0].type).toBe('field');
    });

    it('should inherit priority from policy when rule has no priority', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        priority: 'high',
        rules: [{ permissions: ['user:read'], effect: 'allow', conditions: [], priority: undefined }],
      };

      const compiled = compilePolicy(policy);
      // Rule priority = policy priority (100) + index * 0.001
      // Index 0 means no fractional part
      expect(compiled.rules[0].priority).toBe(100);
    });

    it('should use rule priority when specified', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        priority: 'low',
        rules: [{ permissions: ['user:read'], effect: 'allow', conditions: [], priority: 'critical' }],
      };

      const compiled = compilePolicy(policy);
      // Rule priority = rule priority (1000) + index * 0.001
      // Index 0 means no fractional part
      expect(compiled.rules[0].priority).toBe(1000);
    });

    it('should add sub-sorting by rule index', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [
          { permissions: ['user:read'], effect: 'allow', conditions: [] },
          { permissions: ['user:write'], effect: 'allow', conditions: [] },
        ],
      };

      const compiled = compilePolicy(policy);
      // Both have same base priority (50), with different index offsets
      // After sorting (descending): rules[0] has higher priority (50.001), rules[1] has lower (50)
      // Index 0: 50 + 0*0.001 = 50, Index 1: 50 + 1*0.001 = 50.001
      // Sorted: 50.001 first, then 50
      expect(compiled.rules[0].priority).toBe(50.001);
      expect(compiled.rules[1].priority).toBe(50);
    });

    it('should sort rules by priority descending', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [
          { permissions: ['user:read'], effect: 'allow', conditions: [], priority: 'low' },
          { permissions: ['user:write'], effect: 'allow', conditions: [], priority: 'high' },
        ],
      };

      const compiled = compilePolicy(policy);
      // High priority (100) should come first
      expect(compiled.rules[0].permissions.has('user:write')).toBe(true);
      expect(compiled.rules[1].permissions.has('user:read')).toBe(true);
    });

    it('should create rule evaluator function', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [
          {
            permissions: ['user:read'],
            effect: 'allow',
            conditions: [{ type: 'field', field: 'subject.id', operator: 'eq', value: 'user-1' }],
          },
        ],
      };

      const compiled = compilePolicy(policy);
      expect(typeof compiled.rules[0].evaluate).toBe('function');
    });
  });

  describe('compilePolicy - multiple rules', () => {
    it('should compile policy with multiple rules', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [
          { permissions: ['user:read'], effect: 'allow', conditions: [] },
          { permissions: ['user:write'], effect: 'allow', conditions: [] },
          { permissions: ['user:delete'], effect: 'deny', conditions: [] },
        ],
      };

      const compiled = compilePolicy(policy);
      expect(compiled.rules).toHaveLength(3);
    });

    it('should handle mixed priority rules', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [
          { permissions: ['low'], effect: 'allow', conditions: [], priority: 'low' },
          { permissions: ['normal'], effect: 'allow', conditions: [], priority: 'normal' },
          { permissions: ['high'], effect: 'allow', conditions: [], priority: 'high' },
        ],
      };

      const compiled = compilePolicy(policy);
      // Should be sorted: high, normal, low
      expect(compiled.rules[0].permissions.has('high')).toBe(true);
      expect(compiled.rules[1].permissions.has('normal')).toBe(true);
      expect(compiled.rules[2].permissions.has('low')).toBe(true);
    });
  });

  describe('compilePolicies', () => {
    it('should throw for non-array input', () => {
      expect(() => compilePolicies(null as any)).toThrow('policies 必须是数组');
      expect(() => compilePolicies({} as any)).toThrow('policies 必须是数组');
    });

    it('should compile and sort multiple policies', () => {
      const policies: PolicyDefinition[] = [
        {
          id: 'policy-low',
          rules: [{ permissions: ['read'], effect: 'allow', conditions: [] }],
          priority: 'low',
        },
        {
          id: 'policy-high',
          rules: [{ permissions: ['write'], effect: 'allow', conditions: [] }],
          priority: 'high',
        },
      ];

      const compiled = compilePolicies(policies);
      expect(compiled).toHaveLength(2);
      expect(compiled[0].id).toBe('policy-high');
      expect(compiled[1].id).toBe('policy-low');
    });

    it('should handle empty array', () => {
      const compiled = compilePolicies([]);
      expect(compiled).toHaveLength(0);
    });

    it('should propagate individual compilation errors', () => {
      const policies: PolicyDefinition[] = [
        { id: 'valid', rules: [{ permissions: ['read'], effect: 'allow', conditions: [] }] },
        { id: 'invalid', rules: [{ permissions: [], effect: 'allow', conditions: [] }] }, // empty permissions
      ];

      expect(() => compilePolicies(policies)).toThrow('编译策略失败');
    });
  });

  describe('mergePolicies', () => {
    it('should throw for non-array input', () => {
      expect(() => mergePolicies(null as any, { id: 'merged', name: 'Merged' })).toThrow('policies 必须是非空数组');
      expect(() => mergePolicies({} as any, { id: 'merged', name: 'Merged' })).toThrow('policies 必须是非空数组');
    });

    it('should throw for empty array', () => {
      expect(() => mergePolicies([], { id: 'merged', name: 'Merged' })).toThrow('policies 必须是非空数组');
    });

    it('should throw for invalid options', () => {
      expect(() => mergePolicies([{ id: 'p1', rules: [] }], null as any)).toThrow('options 必须是对象');
      expect(() => mergePolicies([{ id: 'p1', rules: [] }], { id: 123 } as any)).toThrow('options.id 必须是字符串');
      expect(() => mergePolicies([{ id: 'p1', rules: [] }], { id: 'test' } as any)).toThrow('options.name 必须是字符串');
    });

    it('should throw for invalid policy rules', () => {
      const policies: PolicyDefinition[] = [
        { id: 'p1', rules: null as any },
      ];
      expect(() => mergePolicies(policies, { id: 'merged', name: 'Merged' })).toThrow('rules 必须是数组');
    });

    it('should merge policies into single policy', () => {
      const policies: PolicyDefinition[] = [
        {
          id: 'p1',
          rules: [{ permissions: ['read'], effect: 'allow', conditions: [] }],
          priority: 'normal',
        },
        {
          id: 'p2',
          rules: [{ permissions: ['write'], effect: 'allow', conditions: [] }],
          priority: 'high',
        },
      ];

      const merged = mergePolicies(policies, { id: 'merged-policy', name: 'Merged Policy' });

      expect(merged.id).toBe('merged-policy');
      expect(merged.name).toBe('Merged Policy');
      expect(merged.rules).toHaveLength(2);
      expect(merged.enabled).toBe(true);
    });

    it('should use highest priority from merged policies', () => {
      const policies: PolicyDefinition[] = [
        { id: 'p1', rules: [{ permissions: ['read'], effect: 'allow', conditions: [] }], priority: 'low' },
        { id: 'p2', rules: [{ permissions: ['write'], effect: 'allow', conditions: [] }], priority: 'high' },
      ];

      const merged = mergePolicies(policies, { id: 'merged', name: 'Merged' });
      expect(merged.priority).toBe('high');
    });

    it('should collect all rules from all policies', () => {
      const policies: PolicyDefinition[] = [
        {
          id: 'p1',
          rules: [
            { permissions: ['read'], effect: 'allow', conditions: [] },
            { permissions: ['list'], effect: 'allow', conditions: [] },
          ],
        },
        { id: 'p2', rules: [{ permissions: ['write'], effect: 'allow', conditions: [] }] },
      ];

      const merged = mergePolicies(policies, { id: 'merged', name: 'Merged' });
      expect(merged.rules).toHaveLength(3);
    });

    it('should handle policies with conditions', () => {
      const policies: PolicyDefinition[] = [
        {
          id: 'p1',
          rules: [{
            permissions: ['read'],
            effect: 'allow',
            conditions: [{ type: 'field', field: 'subject.role', operator: 'eq', value: 'admin' }],
          }],
        },
      ];

      const merged = mergePolicies(policies, { id: 'merged', name: 'Merged' });
      expect(merged.rules[0].conditions).toHaveLength(1);
    });
  });

  describe('Compiled Policy structure', () => {
    it('should include tenantId from original policy', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [{ permissions: ['read'], effect: 'allow', conditions: [] }],
        tenantId: 'tenant-1',
      };

      const compiled = compilePolicy(policy);
      expect(compiled.tenantId).toBe('tenant-1');
    });

    it('should set enabled from policy', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [{ permissions: ['read'], effect: 'allow', conditions: [] }],
        enabled: true,
      };

      const compiled = compilePolicy(policy);
      expect(compiled.enabled).toBe(true);
    });

    it('should preserve rule effect', () => {
      const policy: PolicyDefinition = {
        id: 'test',
        rules: [
          { permissions: ['read'], effect: 'allow', conditions: [], priority: 'high' as const },
          { permissions: ['delete'], effect: 'deny', conditions: [], priority: 'low' as const },
        ],
      };

      const compiled = compilePolicy(policy);
      // Rules are sorted by priority, so high priority (allow) comes first
      expect(compiled.rules[0].effect).toBe('allow');
      expect(compiled.rules[1].effect).toBe('deny');
    });
  });
});
