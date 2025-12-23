import { describe, it, expect } from 'vitest';
import { defineResource } from '../resource/define.js';
import { z } from 'zod';

describe('defineResource', () => {
  describe('basic resource definition', () => {
    it('should create resource with CRUD features', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({
          id: z.string(),
          name: z.string(),
        }),
        features: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
      });

      expect(resource.name).toBe('user');
      expect(resource.schema).toBeDefined();
      expect(resource.features.create).toBe(true);
      expect(resource.features.read).toBe(true);
      // May include 'list' feature by default
      expect(resource.permissions.length).toBeGreaterThanOrEqual(4);
    });

    it('should generate correct permission codes', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { create: true, read: true, update: true, delete: true },
      });

      const actions = resource.permissions.map(p => p.action);
      expect(actions).toContain('create');
      expect(actions).toContain('read');
      expect(actions).toContain('update');
      expect(actions).toContain('delete');
    });

    it('should auto-generate displayName', () => {
      const resource = defineResource({
        name: 'userProfile',
        schema: z.object({ id: z.string() }),
        features: { read: true },
      });

      expect(resource.metadata.displayName).toBe('User Profile');
    });

    it('should auto-generate pluralName', () => {
      expect(defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { read: true },
      }).metadata.pluralName).toBe('Users');

      expect(defineResource({
        name: 'category',
        schema: z.object({ id: z.string() }),
        features: { read: true },
      }).metadata.pluralName).toBe('Categories');

      expect(defineResource({
        name: 'address',
        schema: z.object({ id: z.string() }),
        features: { read: true },
      }).metadata.pluralName).toBe('Addresses');
    });

    it('should use custom displayName when provided', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { read: true },
        metadata: { displayName: '用户管理' },
      });

      expect(resource.metadata.displayName).toBe('用户管理');
    });
  });

  describe('custom permissions', () => {
    it('should merge custom permissions with CRUD', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { create: true, read: true },
        permissions: [
          { action: 'export', description: '导出用户数据' },
          { action: 'import', description: '导入用户数据' },
        ],
      });

      // 2 CRUD + 2 custom
      expect(resource.permissions.length).toBeGreaterThanOrEqual(4);
      const actions = resource.permissions.map(p => p.action);
      expect(actions).toContain('export');
      expect(actions).toContain('import');
    });

    it('should override CRUD with custom permission', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { create: true },
        permissions: [
          {
            action: 'create',
            description: 'Custom create description',
            // Custom permission should override the auto-generated one
          },
        ],
      });

      const createPermission = resource.permissions.find(p => p.action === 'create');
      expect(createPermission?.description).toBe('Custom create description');
    });
  });

  describe('custom schemas', () => {
    it('should use custom createSchema', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({
          id: z.string(),
          name: z.string(),
          password: z.string(),
        }),
        createSchema: z.object({
          name: z.string(),
          password: z.string(),
        }),
        features: { create: true, read: true },
      });

      expect(resource.createSchema).toBeDefined();
    });

    it('should auto-generate updateSchema as partial', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
        }),
        features: { update: true },
      });

      expect(resource.updateSchema).toBeDefined();
    });
  });

  describe('hooks', () => {
    it('should include hooks in resource', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string(), name: z.string() }),
        features: { create: true },
        hooks: {
          beforeCreate: async (ctx, input) => input,
        },
      });

      expect(resource.hooks).toBeDefined();
      expect(resource.hooks.beforeCreate).toBeDefined();
    });
  });

  describe('relations', () => {
    it('should include relations', () => {
      const resource = defineResource({
        name: 'order',
        schema: z.object({ id: z.string(), userId: z.string() }),
        features: { read: true },
        relations: [
          { type: 'belongsTo', resource: 'user', foreignKey: 'userId' },
        ],
      });

      expect(resource.relations).toHaveLength(1);
      expect(resource.relations[0].type).toBe('belongsTo');
    });
  });

  describe('metadata', () => {
    it('should include all metadata fields', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { read: true },
        metadata: {
          displayName: 'Users',
          pluralName: 'User List',
          description: 'User management',
          icon: 'user-icon',
          group: 'admin',
          sortOrder: 10,
          hidden: false,
          tags: ['important', 'system'],
        },
      });

      expect(resource.metadata.displayName).toBe('Users');
      expect(resource.metadata.description).toBe('User management');
      expect(resource.metadata.icon).toBe('user-icon');
      expect(resource.metadata.group).toBe('admin');
      expect(resource.metadata.sortOrder).toBe(10);
      expect(resource.metadata.hidden).toBe(false);
      expect(resource.metadata.tags).toEqual(['important', 'system']);
    });
  });

  describe('input validation', () => {
    it('should throw on invalid input', () => {
      expect(() => defineResource(null as any)).toThrow('input 必须是对象');
      expect(() => defineResource({} as any)).toThrow('input.name 必须是字符串');
      expect(() => defineResource({ name: 'user' } as any)).toThrow('input.schema 必须是对象');
    });
  });

  describe('list feature', () => {
    it('should generate list permission', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { list: true },
      });

      const actions = resource.permissions.map(p => p.action);
      expect(actions).toContain('list');
    });
  });
});
