import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionChecker, createSimpleChecker, createAllowAllChecker, createDenyAllChecker } from '../permission/checker.js';

describe('PermissionChecker', () => {
  let checker: PermissionChecker;

  const createContext = (
    tenantId: string = 'tenant-1',
    subjectId: string = 'user-1',
    resource: string = 'user',
    action: string = 'read'
  ) => ({
    tenant: { id: tenantId },
    subject: { id: subjectId, type: 'user' as const },
    resource,
    action,
  });

  describe('constructor', () => {
    it('should create checker with resolver function', () => {
      const resolver = async () => new Set(['user:read']);
      checker = new PermissionChecker(resolver);
      expect(checker).toBeInstanceOf(PermissionChecker);
    });
  });

  describe('check - system subject', () => {
    it('should allow all permissions for system subject', async () => {
      checker = createAllowAllChecker();
      const context = createContext('tenant-1', 'system', 'user', 'delete');

      const result = await checker.check({
        ...context,
        subject: { id: 'system', type: 'system' },
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('System subject has full access');
    });
  });

  describe('check - permissions from resolver', () => {
    it('should allow when subject has specific permission', async () => {
      checker = createSimpleChecker(async () => new Set(['user:read']));
      const context = createContext('tenant-1', 'user-1', 'user', 'read');

      const result = await checker.check(context);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Specific permission granted');
    });

    it('should allow when subject has wildcard permission', async () => {
      checker = createSimpleChecker(async () => new Set(['*']));
      const context = createContext('tenant-1', 'user-1', 'user', 'read');

      const result = await checker.check(context);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Wildcard permission');
    });

    it('should deny when subject lacks permission', async () => {
      checker = createSimpleChecker(async () => new Set(['user:read']));
      const context = createContext('tenant-1', 'user-1', 'user', 'delete');

      const result = await checker.check(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Permission not granted');
    });
  });

  describe('check - wildcard permissions from resolver', () => {
    it('should allow global wildcard permission', async () => {
      checker = createSimpleChecker(async () => new Set(['*']));
      const context = createContext('tenant-1', 'user-1', 'order', 'create');

      const result = await checker.check(context);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Wildcard permission');
    });

    it('should allow resource wildcard permission', async () => {
      checker = createSimpleChecker(async () => new Set(['user:*']));
      const context = createContext('tenant-1', 'user-1', 'user', 'update');

      const result = await checker.check(context);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Resource wildcard permission');
    });
  });

  describe('check - specific permissions', () => {
    it('should allow specific permission', async () => {
      checker = createSimpleChecker(async () => new Set(['user:read', 'user:update']));
      const context = createContext('tenant-1', 'user-1', 'user', 'read');

      const result = await checker.check(context);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Specific permission granted');
    });

    it('should deny specific permission not in set', async () => {
      checker = createSimpleChecker(async () => new Set(['user:read']));
      const context = createContext('tenant-1', 'user-1', 'user', 'delete');

      const result = await checker.check(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Permission not granted');
    });
  });

  describe('check - result object', () => {
    it('should include permission code in result', async () => {
      checker = createAllowAllChecker();
      const context = createContext('tenant-1', 'user-1', 'user', 'read');

      const result = await checker.check(context);

      expect(result.permission).toBe('user:read');
    });

    it('should include evaluation time in result', async () => {
      checker = createAllowAllChecker();
      const context = createContext('tenant-1', 'user-1', 'user', 'read');

      const result = await checker.check(context);

      expect(typeof result.evaluationTime).toBe('number');
      expect(result.evaluationTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkOrThrow', () => {
    it('should not throw when permission granted', async () => {
      checker = createAllowAllChecker();
      const context = createContext('tenant-1', 'user-1', 'user', 'read');

      await expect(checker.checkOrThrow(context)).resolves.not.toThrow();
    });

    it('should throw PermissionDeniedError when permission denied', async () => {
      checker = createDenyAllChecker();
      const context = createContext('tenant-1', 'user-1', 'user', 'read');

      await expect(checker.checkOrThrow(context)).rejects.toThrow();
    });
  });

  describe('checkMany', () => {
    it('should check multiple permissions', async () => {
      checker = createSimpleChecker(async () => new Set(['user:read', 'user:update']));
      const contexts = [
        createContext('tenant-1', 'user-1', 'user', 'read'),
        createContext('tenant-1', 'user-1', 'user', 'update'),
        createContext('tenant-1', 'user-1', 'user', 'delete'),
      ];

      const result = await checker.checkMany(contexts);

      expect(result.results.size).toBe(3);
      expect(result.allAllowed).toBe(false);
      expect(result.anyAllowed).toBe(true);
    });

    it('should return allAllowed true when all permissions granted', async () => {
      checker = createAllowAllChecker();
      const contexts = [
        createContext('tenant-1', 'user-1', 'user', 'read'),
        createContext('tenant-1', 'user-1', 'user', 'update'),
      ];

      const result = await checker.checkMany(contexts);

      expect(result.allAllowed).toBe(true);
    });

    it('should handle empty array', async () => {
      checker = createAllowAllChecker();

      const result = await checker.checkMany([]);

      expect(result.results.size).toBe(0);
      expect(result.allAllowed).toBe(true);
      expect(result.anyAllowed).toBe(false);
    });

    it('should throw on invalid input', async () => {
      checker = createAllowAllChecker();

      await expect(checker.checkMany(null as any)).rejects.toThrow('contexts 必须是一个数组');
    });

    it('should execute sequentially when parallel is false', async () => {
      checker = createSimpleChecker(async () => new Set(['user:read']));
      const contexts = [
        createContext('tenant-1', 'user-1', 'user', 'read'),
        createContext('tenant-1', 'user-1', 'user', 'update'),
      ];

      const result = await checker.checkMany(contexts, { parallel: false });

      expect(result.results.size).toBe(2);
    });
  });

  describe('hasAny', () => {
    it('should return true when any permission is granted', async () => {
      checker = createSimpleChecker(async () => new Set(['user:read']));
      const context = { tenant: { id: 'tenant-1' }, subject: { id: 'user-1', type: 'user' as const } };

      const result = await checker.hasAny(context, ['user:read', 'order:create']);

      expect(result).toBe(true);
    });

    it('should return false when no permission is granted', async () => {
      checker = createDenyAllChecker();
      const context = { tenant: { id: 'tenant-1' }, subject: { id: 'user-1', type: 'user' as const } };

      const result = await checker.hasAny(context, ['user:read', 'order:create']);

      expect(result).toBe(false);
    });
  });

  describe('hasAll', () => {
    it('should return true when all permissions are granted', async () => {
      checker = createSimpleChecker(async () => new Set(['user:read', 'user:update']));
      const context = { tenant: { id: 'tenant-1' }, subject: { id: 'user-1', type: 'user' as const } };

      const result = await checker.hasAll(context, ['user:read', 'user:update']);

      expect(result).toBe(true);
    });

    it('should return false when any permission is denied', async () => {
      checker = createSimpleChecker(async () => new Set(['user:read']));
      const context = { tenant: { id: 'tenant-1' }, subject: { id: 'user-1', type: 'user' as const } };

      const result = await checker.hasAll(context, ['user:read', 'user:delete']);

      expect(result).toBe(false);
    });
  });

  describe('factory functions', () => {
    it('createSimpleChecker should work with sync function', () => {
      const checker = createSimpleChecker(() => new Set(['user:read']));
      expect(checker).toBeInstanceOf(PermissionChecker);
    });

    it('createAllowAllChecker should allow all permissions', async () => {
      const checker = createAllowAllChecker();
      const result = await checker.check(createContext('tenant-1', 'user-1', 'any', 'any'));
      expect(result.allowed).toBe(true);
    });

    it('createDenyAllChecker should deny all permissions', async () => {
      const checker = createDenyAllChecker();
      const result = await checker.check(createContext('tenant-1', 'user-1', 'any', 'any'));
      expect(result.allowed).toBe(false);
    });
  });
});
