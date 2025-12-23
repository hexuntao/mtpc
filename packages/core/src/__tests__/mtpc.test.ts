import { describe, it, expect, beforeEach } from 'vitest';
import { createMTPC, MTPC } from '../mtpc.js';
import { createUserResource, createOrderResource } from './helpers.js';
import { ANONYMOUS_SUBJECT, SYSTEM_SUBJECT } from '../types/context.js';

describe('MTPC', () => {
  let mtpc: MTPC;

  beforeEach(() => {
    mtpc = createMTPC();
  });

  describe('constructor', () => {
    it('should create MTPC instance', () => {
      expect(mtpc).toBeInstanceOf(MTPC);
    });

    it('should have all subsystems', () => {
      expect(mtpc.registry).toBeDefined();
      expect(mtpc.policyEngine).toBeDefined();
      expect(mtpc.permissionChecker).toBeDefined();
      expect(mtpc.globalHooks).toBeDefined();
      expect(mtpc.plugins).toBeDefined();
      expect(mtpc.tenants).toBeDefined();
    });
  });

  describe('registerResource', () => {
    it('should register a resource', () => {
      mtpc.registerResource(createUserResource());

      const resources = mtpc.getResourceNames();
      expect(resources).toContain('user');
    });

    it('should return this for chaining', () => {
      const result = mtpc.registerResource(createUserResource());
      expect(result).toBe(mtpc);
    });

    it('should register multiple resources', () => {
      mtpc.registerResources([createUserResource(), createOrderResource()]);

      const resources = mtpc.getResourceNames();
      expect(resources).toContain('user');
      expect(resources).toContain('order');
    });
  });

  describe('registerPolicy', () => {
    it('should register a policy', () => {
      mtpc.registerPolicy({
        id: 'admin-policy',
        name: 'Admin Policy',
        rules: [
          {
            permissions: ['*'],
            effect: 'allow' as const,
            conditions: [],
          },
        ],
        priority: 'high' as const,
        enabled: true,
      });

      const policies = mtpc.policyEngine.listPolicies();
      expect(policies).toHaveLength(1);
    });

    it('should return this for chaining', () => {
      const result = mtpc.registerPolicy({
        id: 'test-policy',
        name: 'Test',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      });
      expect(result).toBe(mtpc);
    });
  });

  describe('use (plugin)', () => {
    it('should register a plugin', () => {
      mtpc.use({
        name: 'test-plugin',
        install: async () => {},
      });

      const plugins = mtpc.plugins.list();
      expect(plugins).toHaveLength(1);
    });

    it('should return this for chaining', () => {
      const result = mtpc.use({
        name: 'test-plugin',
        install: async () => {},
      });
      expect(result).toBe(mtpc);
    });
  });

  describe('init', () => {
    it('should initialize MTPC', async () => {
      mtpc.registerResource(createUserResource());
      await mtpc.init();

      expect(mtpc.isInitialized()).toBe(true);
    });

    it('should freeze registry', async () => {
      mtpc.registerResource(createUserResource());
      await mtpc.init();

      expect(mtpc.registry.isFrozen()).toBe(true);
    });

    it('should not throw when already initialized', async () => {
      mtpc.registerResource(createUserResource());
      await mtpc.init();
      await mtpc.init(); // Should not throw
    });

    it('should install plugins', async () => {
      let pluginInstalled = false;
      mtpc.use({
        name: 'test-plugin',
        install: async () => { pluginInstalled = true; },
      });

      await mtpc.init();
      expect(pluginInstalled).toBe(true);
    });
  });

  describe('createContext', () => {
    it('should create context with tenant', () => {
      const context = mtpc.createContext({ id: 'tenant-1' });

      expect(context.tenant.id).toBe('tenant-1');
      expect(context.subject).toEqual(ANONYMOUS_SUBJECT);
    });

    it('should create context with tenant and subject', () => {
      const context = mtpc.createContext(
        { id: 'tenant-1', status: 'active' },
        { id: 'user-1', type: 'user', roles: ['admin'] }
      );

      expect(context.tenant.id).toBe('tenant-1');
      expect(context.subject.id).toBe('user-1');
      expect(context.subject.type).toBe('user');
    });
  });

  describe('checkPermission', () => {
    it('should deny permission when no policies', async () => {
      mtpc.registerResource(createUserResource());
      await mtpc.init();

      const context = mtpc.createContext({ id: 'tenant-1' }, { id: 'user-1', type: 'user' });
      const result = await mtpc.checkPermission({
        ...context,
        resource: 'user',
        action: 'read',
      });

      expect(result.allowed).toBe(false);
    });

    it('should allow permission with wildcard policy', async () => {
      mtpc.registerResource(createUserResource());
      mtpc.registerPolicy({
        id: 'allow-all',
        name: 'Allow All',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      });
      await mtpc.init();

      const context = mtpc.createContext({ id: 'tenant-1' }, { id: 'user-1', type: 'user' });
      const result = await mtpc.checkPermission({
        ...context,
        resource: 'user',
        action: 'delete',
      });

      expect(result.allowed).toBe(true);
    });

    it('should allow system subject all permissions', async () => {
      mtpc.registerResource(createUserResource());
      await mtpc.init();

      const context = mtpc.createContext({ id: 'tenant-1' }, SYSTEM_SUBJECT);
      const result = await mtpc.checkPermission({
        ...context,
        resource: 'user',
        action: 'delete',
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('System subject has full access');
    });
  });

  describe('requirePermission', () => {
    it('should not throw when permission granted', async () => {
      mtpc.registerResource(createUserResource());
      mtpc.registerPolicy({
        id: 'allow-all',
        name: 'Allow All',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      });
      await mtpc.init();

      const context = mtpc.createContext({ id: 'tenant-1' }, { id: 'user-1', type: 'user' });
      await expect(mtpc.requirePermission({
        ...context,
        resource: 'user',
        action: 'read',
      })).resolves.not.toThrow();
    });

    it('should throw when permission denied', async () => {
      mtpc.registerResource(createUserResource());
      await mtpc.init();

      const context = mtpc.createContext({ id: 'tenant-1' }, { id: 'user-1', type: 'user' });
      await expect(mtpc.requirePermission({
        ...context,
        resource: 'user',
        action: 'read',
      })).rejects.toThrow();
    });
  });

  describe('evaluatePolicy', () => {
    it('should evaluate policy', async () => {
      mtpc.registerResource(createUserResource());
      mtpc.registerPolicy({
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
      await mtpc.init();

      const context = mtpc.createContext({ id: 'tenant-1' }, { id: 'user-1', type: 'user' });
      const result = await mtpc.evaluatePolicy({
        tenant: context.tenant,
        subject: context.subject,
        permission: { code: 'user:read', resource: 'user', action: 'read' },
        resource: {},
      });

      expect(result.effect).toBe('allow');
    });
  });

  describe('getPermissionCodes', () => {
    it('should return all permission codes', async () => {
      mtpc.registerResource(createUserResource());
      await mtpc.init();

      const codes = mtpc.getPermissionCodes();

      expect(codes).toHaveProperty('USER_CREATE', 'user:create');
      expect(codes).toHaveProperty('USER_READ', 'user:read');
    });
  });

  describe('getResourceNames', () => {
    it('should return all resource names', async () => {
      mtpc.registerResources([createUserResource(), createOrderResource()]);
      await mtpc.init();

      const names = mtpc.getResourceNames();

      expect(names).toContain('user');
      expect(names).toContain('order');
    });
  });

  describe('getResource', () => {
    it('should return resource by name', async () => {
      mtpc.registerResource(createUserResource());
      await mtpc.init();

      const resource = mtpc.getResource('user');

      expect(resource).toBeDefined();
      expect(resource?.name).toBe('user');
    });

    it('should return undefined for non-existent resource', async () => {
      await mtpc.init();

      const resource = mtpc.getResource('non-existent');
      expect(resource).toBeUndefined();
    });
  });

  describe('exportMetadata', () => {
    it('should export metadata for UI', async () => {
      mtpc.registerResource(createUserResource());
      await mtpc.init();

      const metadata = mtpc.exportMetadata();

      expect(metadata.resources).toHaveLength(1);
      expect(metadata.resources[0].name).toBe('user');
      expect(metadata.resources[0].permissions).toContain('user:read');
    });
  });

  describe('getSummary', () => {
    it('should return system summary', async () => {
      mtpc.registerResource(createUserResource());
      mtpc.registerPolicy({
        id: 'test-policy',
        name: 'Test',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      });
      await mtpc.init();

      const summary = mtpc.getSummary();

      expect(summary.initialized).toBe(true);
      expect(summary.resources).toBe(1);
      expect(summary.policies).toBe(1);
    });
  });

  describe('isInitialized', () => {
    it('should return false before init', () => {
      expect(mtpc.isInitialized()).toBe(false);
    });

    it('should return true after init', async () => {
      await mtpc.init();
      expect(mtpc.isInitialized()).toBe(true);
    });
  });

  describe('defaultPermissionResolver', () => {
    it('should resolve permissions from policies', async () => {
      mtpc.registerResource(createUserResource());
      mtpc.registerPolicy({
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
      await mtpc.init();

      const context = mtpc.createContext({ id: 'tenant-1' }, { id: 'user-1', type: 'user' });

      // user:read should be allowed (has policy)
      const readResult = await mtpc.checkPermission({
        ...context,
        resource: 'user',
        action: 'read',
      });
      expect(readResult.allowed).toBe(true);

      // user:delete should be denied (no policy)
      const deleteResult = await mtpc.checkPermission({
        ...context,
        resource: 'user',
        action: 'delete',
      });
      expect(deleteResult.allowed).toBe(false);
    });
  });

  describe('customPermissionResolver', () => {
    it('should use custom permission resolver', async () => {
      mtpc = createMTPC({
        defaultPermissionResolver: async () => new Set(['user:read', 'user:update']),
      });
      mtpc.registerResource(createUserResource());
      await mtpc.init();

      const context = mtpc.createContext({ id: 'tenant-1' }, { id: 'user-1', type: 'user' });

      const readResult = await mtpc.checkPermission({
        ...context,
        resource: 'user',
        action: 'read',
      });
      expect(readResult.allowed).toBe(true);

      const deleteResult = await mtpc.checkPermission({
        ...context,
        resource: 'user',
        action: 'delete',
      });
      expect(deleteResult.allowed).toBe(false);
    });
  });

  describe('full workflow', () => {
    it('should handle complete permission workflow', async () => {
      // 1. Create MTPC without custom resolver (uses built-in policy-based resolver)
      mtpc = createMTPC();

      // 2. Register resources
      mtpc.registerResources([createUserResource(), createOrderResource()]);

      // 3. Register policies - admin gets wildcard, user-1 gets specific permissions
      mtpc.registerPolicy({
        id: 'admin-policy',
        name: 'Admin Policy',
        rules: [
          {
            permissions: ['*'],
            effect: 'allow' as const,
            conditions: [{
              type: 'field' as const,
              field: 'subject.id',
              operator: 'eq' as const,
              value: 'admin',
            }],
          },
        ],
        priority: 'high' as const,
        enabled: true,
      });

      mtpc.registerPolicy({
        id: 'user-policy',
        name: 'User Policy',
        rules: [
          {
            permissions: ['user:read', 'user:update'],
            effect: 'allow' as const,
            conditions: [{
              type: 'field' as const,
              field: 'subject.id',
              operator: 'eq' as const,
              value: 'user-1',
            }],
          },
          {
            permissions: ['order:*'],
            effect: 'allow' as const,
            conditions: [{
              type: 'field' as const,
              field: 'subject.id',
              operator: 'eq' as const,
              value: 'user-1',
            }],
          },
        ],
        priority: 'normal' as const,
        enabled: true,
      });

      // 4. Initialize
      await mtpc.init();

      // 5. Check permissions for admin
      let context = mtpc.createContext({ id: 'tenant-1' }, { id: 'admin', type: 'user' });
      let result = await mtpc.checkPermission({
        ...context,
        resource: 'user',
        action: 'delete',
      });
      expect(result.allowed).toBe(true); // Admin has wildcard from policy

      // 6. Check permissions for regular user - read should be allowed
      context = mtpc.createContext({ id: 'tenant-1' }, { id: 'user-1', type: 'user' });
      result = await mtpc.checkPermission({
        ...context,
        resource: 'user',
        action: 'read',
      });
      expect(result.allowed).toBe(true); // Has user:read from policy

      // 7. Check permission that should be denied
      result = await mtpc.checkPermission({
        ...context,
        resource: 'user',
        action: 'delete',
      });
      expect(result.allowed).toBe(false);

      // 8. Check order access (from policy)
      result = await mtpc.checkPermission({
        ...context,
        resource: 'order',
        action: 'create',
      });
      expect(result.allowed).toBe(true); // Has order:* from policy
    });
  });
});

describe('createMTPC factory', () => {
  it('should create MTPC instance', () => {
    const mtpc = createMTPC();
    expect(mtpc).toBeInstanceOf(MTPC);
  });

  it('should accept options', () => {
    const mtpc = createMTPC({
      defaultPermissionResolver: async () => new Set(['*']),
    });
    expect(mtpc).toBeInstanceOf(MTPC);
  });
});
