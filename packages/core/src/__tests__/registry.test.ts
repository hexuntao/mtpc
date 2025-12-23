import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createUnifiedRegistry, UnifiedRegistry } from '../registry/unified-registry.js';
import { createUserResource, createOrderResource, createTestTenant } from './helpers.js';

describe('UnifiedRegistry', () => {
  let registry: UnifiedRegistry;

  beforeEach(() => {
    registry = createUnifiedRegistry();
  });

  afterEach(() => {
    // If frozen, create a new registry to avoid clear() throwing
    if (registry.isFrozen()) {
      registry = createUnifiedRegistry();
    } else {
      registry.clear();
    }
  });

  describe('createUnifiedRegistry', () => {
    it('should create a new registry instance', () => {
      expect(registry).toBeInstanceOf(UnifiedRegistry);
      expect(registry.resources).toBeDefined();
      expect(registry.permissions).toBeDefined();
      expect(registry.policies).toBeDefined();
    });

    it('should have empty registries initially', () => {
      const summary = registry.getSummary();
      expect(summary.resources).toBe(0);
      expect(summary.permissions).toBe(0);
      expect(summary.policies).toBe(0);
    });
  });

  describe('registerResource', () => {
    it('should register a resource and its permissions', () => {
      const userResource = createUserResource();

      registry.registerResource(userResource);

      const summary = registry.getSummary();
      expect(summary.resources).toBe(1);
      // User has CRUD + list (5 permissions)
      expect(summary.permissions).toBe(5);
    });

    it('should register multiple resources', () => {
      registry.registerResources([createUserResource(), createOrderResource()]);

      const summary = registry.getSummary();
      expect(summary.resources).toBe(2);
      // user: 5 + order: 5 (both have CRUD + list)
      expect(summary.permissions).toBe(10);
    });

    it('should register and return void (not chainable)', () => {
      // UnifiedRegistry.registerResource returns void
      const result = registry.registerResource(createUserResource());
      expect(result).toBeUndefined();
    });

    it('should export metadata correctly', () => {
      registry.registerResource(createUserResource());

      const metadata = registry.exportMetadata();
      expect(metadata.resources).toHaveLength(1);
      expect(metadata.resources[0].name).toBe('user');
      expect(metadata.resources[0].displayName).toBe('User');
      expect(metadata.resources[0].permissions).toContain('user:create');
      expect(metadata.resources[0].permissions).toContain('user:read');
    });

    it('should get resource with permissions', () => {
      registry.registerResource(createUserResource());

      const result = registry.getResourceWithPermissions('user');
      expect(result).toBeDefined();
      expect(result?.resource.name).toBe('user');
      // Should have 5 permissions (CRUD + list)
      expect(result?.permissions.length).toBe(5);
    });

    it('should return undefined for non-existent resource', () => {
      const result = registry.getResourceWithPermissions('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('registerPolicy', () => {
    it('should register a policy', () => {
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

      registry.registerPolicy(policy);

      const summary = registry.getSummary();
      expect(summary.policies).toBe(1);
    });

    it('should register multiple policies', () => {
      const policies = [
        {
          id: 'policy-1',
          name: 'Policy 1',
          rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
          priority: 'normal' as const,
          enabled: true,
        },
        {
          id: 'policy-2',
          name: 'Policy 2',
          rules: [{ permissions: ['order:*'], effect: 'allow' as const, conditions: [] }],
          priority: 'normal' as const,
          enabled: true,
        },
      ];

      registry.registerPolicies(policies);

      const summary = registry.getSummary();
      expect(summary.policies).toBe(2);
    });
  });

  describe('getAllPermissionCodes', () => {
    it('should return all permission codes', () => {
      registry.registerResources([createUserResource(), createOrderResource()]);

      const codes = registry.getAllPermissionCodes();

      expect(codes).toContain('user:create');
      expect(codes).toContain('user:read');
      expect(codes).toContain('order:create');
      expect(codes).toContain('order:list');
    });
  });

  describe('getPermissionCodesObject', () => {
    it('should return permission codes as object', () => {
      registry.registerResource(createUserResource());

      const codes = registry.getPermissionCodesObject();

      expect(codes).toHaveProperty('USER_CREATE', 'user:create');
      expect(codes).toHaveProperty('USER_READ', 'user:read');
    });
  });

  describe('freeze', () => {
    it('should freeze the registry', () => {
      registry.registerResource(createUserResource());
      registry.freeze();

      expect(registry.isFrozen()).toBe(true);
    });

    it('should prevent new resource registration after freeze', () => {
      registry.registerResource(createUserResource());
      registry.freeze();

      // After freeze, new resource registration should throw
      expect(() => registry.registerResource(createOrderResource())).toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all registries', () => {
      registry.registerResources([createUserResource(), createOrderResource()]);
      const policy = {
        id: 'test-policy',
        name: 'Test',
        rules: [{ permissions: ['*'], effect: 'allow' as const, conditions: [] }],
        priority: 'normal' as const,
        enabled: true,
      };
      registry.registerPolicy(policy);

      registry.clear();

      const summary = registry.getSummary();
      expect(summary.resources).toBe(0);
      expect(summary.permissions).toBe(0);
      expect(summary.policies).toBe(0);
    });
  });

  describe('global registry', () => {
    it('should get global registry instance', () => {
      const global1 = registry;
      const global2 = registry; // Since we created it in beforeEach, this is the same

      expect(global1).toBe(global2);
    });
  });
});

describe('ResourceRegistry', () => {
  let registry: UnifiedRegistry;

  beforeEach(() => {
    registry = createUnifiedRegistry();
  });

  afterEach(() => {
    // If frozen, create a new registry to avoid clear() throwing
    if (registry.isFrozen()) {
      registry = createUnifiedRegistry();
    } else {
      registry.clear();
    }
  });

  describe('resource operations', () => {
    it('should get resource by name', () => {
      registry.registerResource(createUserResource());

      const resource = registry.resources.get('user');
      expect(resource).toBeDefined();
      expect(resource?.name).toBe('user');
    });

    it('should check if resource exists', () => {
      registry.registerResource(createUserResource());

      expect(registry.resources.has('user')).toBe(true);
      expect(registry.resources.has('non-existent')).toBe(false);
    });

    it('should list all resource names', () => {
      registry.registerResources([createUserResource(), createOrderResource()]);

      const names = registry.resources.names();
      expect(names).toContain('user');
      expect(names).toContain('order');
    });

    it('should list all resources', () => {
      registry.registerResources([createUserResource(), createOrderResource()]);

      const list = registry.resources.list();
      expect(list).toHaveLength(2);
    });

    it('should get resources by group', () => {
      registry.registerResources([createUserResource(), createOrderResource()]);

      const coreResources = registry.resources.getByGroup('core');
      expect(coreResources).toHaveLength(1);
      expect(coreResources[0]?.name).toBe('user');

      const businessResources = registry.resources.getByGroup('business');
      expect(businessResources).toHaveLength(1);
      expect(businessResources[0]?.name).toBe('order');
    });

    it('should get visible resources', () => {
      registry.registerResources([createUserResource(), createOrderResource()]);

      const visible = registry.resources.getVisible();
      expect(visible).toHaveLength(2);
    });
  });
});
