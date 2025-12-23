import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultPolicyEngine, createPolicyEngine } from '../policy/engine.js';

describe('DefaultPolicyEngine', () => {
  let engine: DefaultPolicyEngine;

  const createContext = (
    tenantId: string = 'tenant-1',
    subjectId: string = 'user-1',
    permissionCode: string = 'user:read',
    resource: string = 'user',
    action: string = 'read'
  ) => ({
    tenant: { id: tenantId },
    subject: { id: subjectId, type: 'user' as const },
    permission: { code: permissionCode, resource, action },
    resource: {},
  });

  beforeEach(() => {
    engine = createPolicyEngine();
  });

  describe('constructor', () => {
    it('should create engine instance', () => {
      expect(engine).toBeInstanceOf(DefaultPolicyEngine);
    });
  });

  describe('addPolicy', () => {
    it('should add a policy', () => {
      const policy = {
        id: 'test-policy',
        name: 'Test Policy',
        rules: [
          {
            permissions: ['user:read'],
            effect: 'allow' as const,
            conditions: [],
          },
        ],
        priority: 'normal' as const,
        enabled: true,
      };

      engine.addPolicy(policy);

      const policies = engine.listPolicies();
      expect(policies).toHaveLength(1);
      expect(policies[0]?.id).toBe('test-policy');
    });

    it('should throw on duplicate policy id', () => {
      const policy = {
        id: 'test-policy',
        name: 'Test Policy',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      };

      engine.addPolicy(policy);
      expect(() => engine.addPolicy(policy)).toThrow('策略已存在');
    });

    it('should throw on invalid policy', () => {
      expect(() => engine.addPolicy(null as any)).toThrow('policy 必须是对象');
      expect(() => engine.addPolicy({} as any)).toThrow('policy.id 必须是字符串');
    });
  });

  describe('evaluate', () => {
    it('should return deny when no policies', async () => {
      const context = createContext();

      const result = await engine.evaluate(context);

      expect(result.effect).toBe('deny');
    });

    it('should return allow when policy matches', async () => {
      engine.addPolicy({
        id: 'allow-read',
        name: 'Allow Read',
        rules: [
          {
            permissions: ['user:read'],
            effect: 'allow' as const,
            conditions: [],
          },
        ],
        priority: 'normal' as const,
        enabled: true,
      });

      const context = createContext('tenant-1', 'user-1', 'user:read', 'user', 'read');
      const result = await engine.evaluate(context);

      expect(result.effect).toBe('allow');
      expect(result.matchedPolicy).toBe('allow-read');
      expect(result.matchedRule).toBe(0);
    });

    it('should return deny when policy does not match', async () => {
      engine.addPolicy({
        id: 'allow-read',
        name: 'Allow Read',
        rules: [
          {
            permissions: ['user:read'],
            effect: 'allow' as const,
            conditions: [],
          },
        ],
        priority: 'normal' as const,
        enabled: true,
      });

      const context = createContext('tenant-1', 'user-1', 'user:delete', 'user', 'delete');
      const result = await engine.evaluate(context);

      expect(result.effect).toBe('deny');
    });

    it('should support wildcard permissions', async () => {
      engine.addPolicy({
        id: 'wildcard-policy',
        name: 'Wildcard Policy',
        rules: [
          {
            permissions: ['*'],
            effect: 'allow' as const,
            conditions: [],
          },
        ],
        priority: 'normal' as const,
        enabled: true,
      });

      const context = createContext('tenant-1', 'user-1', 'any:action', 'any', 'action');
      const result = await engine.evaluate(context);

      expect(result.effect).toBe('allow');
    });

    it('should support resource wildcard permissions', async () => {
      engine.addPolicy({
        id: 'resource-wildcard',
        name: 'Resource Wildcard',
        rules: [
          {
            permissions: ['user:*'],
            effect: 'allow' as const,
            conditions: [],
          },
        ],
        priority: 'normal' as const,
        enabled: true,
      });

      const context = createContext('tenant-1', 'user-1', 'user:delete', 'user', 'delete');
      const result = await engine.evaluate(context);

      expect(result.effect).toBe('allow');
    });

    it('should skip disabled policies', async () => {
      engine.addPolicy({
        id: 'disabled-policy',
        name: 'Disabled',
        rules: [
          {
            permissions: ['*'],
            effect: 'allow' as const,
            conditions: [],
          },
        ],
        priority: 'normal' as const,
        enabled: false,
      });

      const context = createContext();
      const result = await engine.evaluate(context);

      expect(result.effect).toBe('deny');
    });

    it('should respect priority order', async () => {
      // Add low priority allow policy
      engine.addPolicy({
        id: 'low-priority',
        name: 'Low Priority',
        rules: [
          {
            permissions: ['user:read'],
            effect: 'allow' as const,
            conditions: [],
          },
        ],
        priority: 'low' as const,
        enabled: true,
      });

      // Add high priority deny policy
      engine.addPolicy({
        id: 'high-priority',
        name: 'High Priority',
        rules: [
          {
            permissions: ['user:read'],
            effect: 'deny' as const,
            conditions: [],
          },
        ],
        priority: 'high' as const,
        enabled: true,
      });

      const context = createContext();
      const result = await engine.evaluate(context);

      expect(result.matchedPolicy).toBe('high-priority');
      expect(result.effect).toBe('deny');
    });

    it('should include evaluation path', async () => {
      engine.addPolicy({
        id: 'test-policy',
        name: 'Test',
        rules: [{ permissions: ['user:read'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      });

      const context = createContext();
      const result = await engine.evaluate(context);

      expect(result.evaluationPath).toContain('policy:test-policy');
      expect(result.evaluationPath).toContain('rule:0');
    });
  });

  describe('getPolicy', () => {
    it('should return policy by id', () => {
      engine.addPolicy({
        id: 'test-policy',
        name: 'Test',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      });

      const policy = engine.getPolicy('test-policy');
      expect(policy).toBeDefined();
      expect(policy?.id).toBe('test-policy');
    });

    it('should return undefined for non-existent policy', () => {
      const policy = engine.getPolicy('non-existent');
      expect(policy).toBeUndefined();
    });

    it('should throw on invalid id', () => {
      expect(() => engine.getPolicy('')).toThrow('policyId 必须是字符串');
    });
  });

  describe('listPolicies', () => {
    it('should list all policies', () => {
      engine.addPolicy({
        id: 'policy-1',
        name: 'Policy 1',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      });
      engine.addPolicy({
        id: 'policy-2',
        name: 'Policy 2',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      });

      const policies = engine.listPolicies();
      expect(policies).toHaveLength(2);
    });

    it('should filter by tenant id', () => {
      engine.addPolicy({
        id: 'tenant-1-policy',
        name: 'Tenant 1 Policy',
        tenantId: 'tenant-1',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      });
      engine.addPolicy({
        id: 'tenant-2-policy',
        name: 'Tenant 2 Policy',
        tenantId: 'tenant-2',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      });

      const policies = engine.listPolicies('tenant-1');
      expect(policies).toHaveLength(1);
      expect(policies[0]?.id).toBe('tenant-1-policy');
    });
  });

  describe('removePolicy', () => {
    it('should remove policy by id', () => {
      engine.addPolicy({
        id: 'test-policy',
        name: 'Test',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      });

      engine.removePolicy('test-policy');

      const policies = engine.listPolicies();
      expect(policies).toHaveLength(0);
    });

    it('should throw on invalid id', () => {
      expect(() => engine.removePolicy('')).toThrow('policyId 必须是字符串');
    });
  });

  describe('compile', () => {
    it('should compile a policy without adding it', () => {
      const policy = {
        id: 'test-policy',
        name: 'Test',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      };

      const compiled = engine.compile(policy);

      expect(compiled.id).toBe('test-policy');
      expect(engine.listPolicies()).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all policies', () => {
      engine.addPolicy({
        id: 'test-policy',
        name: 'Test',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      });

      engine.clear();

      expect(engine.listPolicies()).toHaveLength(0);
    });
  });

  describe('input validation', () => {
    it('should validate context in evaluate', async () => {
      await expect(engine.evaluate(null as any)).rejects.toThrow('context 必须是对象');
      await expect(engine.evaluate({} as any)).rejects.toThrow('context.tenant.id 必须是字符串');
      await expect(engine.evaluate({ tenant: { id: 't1' } } as any)).rejects.toThrow('context.subject.id 必须是字符串');
      await expect(engine.evaluate({ tenant: { id: 't1' }, subject: { id: 's1' } } as any)).rejects.toThrow('context.permission.code 必须是字符串');
    });
  });
});
