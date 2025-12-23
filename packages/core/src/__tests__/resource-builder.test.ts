import { describe, it, expect } from 'vitest';
import { resource, ResourceBuilder } from '../resource/builder.js';
import { z } from 'zod';

describe('Resource Builder', () => {
  describe('resource factory function', () => {
    it('should create ResourceBuilder instance', () => {
      const builder = resource('user', z.object({ id: z.string() }));
      expect(builder).toBeInstanceOf(ResourceBuilder);
    });

    it('should create builder with correct name and schema', () => {
      const builder = resource('user', z.object({ id: z.string(), name: z.string() }));
      const result = builder.build();

      expect(result.name).toBe('user');
      expect(result.schema).toBeDefined();
    });
  });

  describe('ResourceBuilder - createSchema', () => {
    it('should set createSchema', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .createSchema(z.object({ name: z.string(), email: z.string().email() }));

      const result = builder.build();
      expect(result.createSchema).toBeDefined();
    });

    it('should preserve original schema', () => {
      const mainSchema = z.object({ id: z.string(), name: z.string() });
      const createSchema = z.object({ name: z.string(), email: z.string().email() });

      const builder = resource('user', mainSchema).createSchema(createSchema);
      const result = builder.build();

      expect(result.schema).toBe(mainSchema);
      expect(result.createSchema).not.toBe(mainSchema);
    });
  });

  describe('ResourceBuilder - updateSchema', () => {
    it('should set updateSchema', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .updateSchema(z.object({ name: z.string().optional() }));

      const result = builder.build();
      expect(result.updateSchema).toBeDefined();
    });
  });

  describe('ResourceBuilder - features', () => {
    it('should throw for null features', () => {
      const builder = resource('user', z.object({ id: z.string() }));
      expect(() => builder.features(null as any)).toThrow('features 必须是对象');
    });

    it('should throw for non-object features', () => {
      const builder = resource('user', z.object({ id: z.string() }));
      expect(() => builder.features('invalid' as any)).toThrow('features 必须是对象');
    });

    it('should set features', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .features({ create: true, read: true, update: true, delete: true, list: true });

      const result = builder.build();
      expect(result.features.create).toBe(true);
      expect(result.features.read).toBe(true);
      expect(result.features.update).toBe(true);
      expect(result.features.delete).toBe(true);
      expect(result.features.list).toBe(true);
    });

    it('should merge features', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .features({ create: true })
        .features({ read: true });

      const result = builder.build();
      expect(result.features.create).toBe(true);
      expect(result.features.read).toBe(true);
    });

    it('should support advanced features', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .features({
          create: true,
          read: true,
          advanced: { softDelete: true, versioning: true },
        });

      const result = builder.build();
      expect(result.features.advanced?.softDelete).toBe(true);
      expect(result.features.advanced?.versioning).toBe(true);
    });
  });

  describe('ResourceBuilder - enable/disable', () => {
    it('should enable operations', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .enable('create', 'read', 'update', 'delete', 'list');

      const result = builder.build();
      expect(result.features.create).toBe(true);
      expect(result.features.read).toBe(true);
      expect(result.features.update).toBe(true);
      expect(result.features.delete).toBe(true);
      expect(result.features.list).toBe(true);
    });

    it('should disable operations', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .enable('create', 'read', 'update', 'delete', 'list')
        .disable('delete', 'update');

      const result = builder.build();
      expect(result.features.delete).toBe(false);
      expect(result.features.update).toBe(false);
    });

    it('should chain multiple enables', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .enable('create')
        .enable('read');

      const result = builder.build();
      expect(result.features.create).toBe(true);
      expect(result.features.read).toBe(true);
    });
  });

  describe('ResourceBuilder - readOnly', () => {
    it('should set read-only mode', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .enable('create', 'read', 'update', 'delete')
        .readOnly();

      const result = builder.build();
      expect(result.features.create).toBe(false);
      expect(result.features.update).toBe(false);
      expect(result.features.delete).toBe(false);
      expect(result.features.read).toBe(true);
    });
  });

  describe('ResourceBuilder - permission methods', () => {
    it('should throw for null permission', () => {
      const builder = resource('user', z.object({ id: z.string() }));
      expect(() => builder.permission(null as any)).toThrow('permission 必须是对象');
    });

    it('should throw for missing action', () => {
      const builder = resource('user', z.object({ id: z.string() }));
      expect(() => builder.permission({} as any)).toThrow('permission.action 必须是字符串');
    });

    it('should add single permission', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .features({ read: true }) // Only enable read, no auto CRUD permissions
        .permission({ action: 'export', description: '导出用户' });

      const result = builder.build();
      expect(result.permissions.find(p => p.action === 'export')).toBeDefined();
      expect(result.permissions.find(p => p.action === 'export')?.description).toBe('导出用户');
    });

    it('should add multiple permissions', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .features({ read: true })
        .permissions([
          { action: 'export', description: '导出' },
          { action: 'import', description: '导入' },
        ]);

      const result = builder.build();
      expect(result.permissions.find(p => p.action === 'export')).toBeDefined();
      expect(result.permissions.find(p => p.action === 'import')).toBeDefined();
    });

    it('should chain permissions', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .features({ read: true })
        .permission({ action: 'export' })
        .permission({ action: 'import' });

      const result = builder.build();
      expect(result.permissions.find(p => p.action === 'export')).toBeDefined();
      expect(result.permissions.find(p => p.action === 'import')).toBeDefined();
    });

    it('should add action with description', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .features({ read: true })
        .action('export', '导出用户数据');

      const result = builder.build();
      expect(result.permissions.find(p => p.action === 'export')).toBeDefined();
      expect(result.permissions.find(p => p.action === 'export')?.description).toBe('导出用户数据');
    });

    it('should add action without description', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .features({ read: true })
        .action('export');

      const result = builder.build();
      expect(result.permissions.find(p => p.action === 'export')).toBeDefined();
      expect(result.permissions.find(p => p.action === 'export')?.description).toBeUndefined();
    });
  });

  describe('ResourceBuilder - relation methods', () => {
    it('should add relation', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .relation({ name: 'posts', type: 'hasMany', target: 'post', foreignKey: 'userId' });

      const result = builder.build();
      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].name).toBe('posts');
      expect(result.relations[0].type).toBe('hasMany');
      expect(result.relations[0].target).toBe('post');
    });

    it('should add hasOne relation', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .hasOne('profile', 'profile', 'userId');

      const result = builder.build();
      expect(result.relations[0].type).toBe('hasOne');
      expect(result.relations[0].target).toBe('profile');
    });

    it('should add hasMany relation', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .hasMany('posts', 'post', 'userId');

      const result = builder.build();
      expect(result.relations[0].type).toBe('hasMany');
      expect(result.relations[0].target).toBe('post');
    });

    it('should add belongsTo relation', () => {
      const builder = resource('post', z.object({ id: z.string(), userId: z.string() }))
        .belongsTo('author', 'user', 'userId');

      const result = builder.build();
      expect(result.relations[0].type).toBe('belongsTo');
      expect(result.relations[0].target).toBe('user');
    });

    it('should add belongsToMany relation', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .belongsToMany('roles', 'role', 'user_roles');

      const result = builder.build();
      expect(result.relations[0].type).toBe('belongsToMany');
      expect(result.relations[0].target).toBe('role');
      expect(result.relations[0].through).toBe('user_roles');
    });

    it('should chain multiple relations', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .hasOne('profile', 'profile')
        .hasMany('posts', 'post')
        .belongsToMany('roles', 'role', 'user_roles');

      const result = builder.build();
      expect(result.relations).toHaveLength(3);
    });
  });

  describe('ResourceBuilder - metadata methods', () => {
    it('should set metadata', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .meta({
          displayName: '用户',
          description: '用户管理',
          group: 'core',
          icon: 'users',
          hidden: false,
          sortOrder: 10,
        });

      const result = builder.build();
      expect(result.metadata.displayName).toBe('用户');
      expect(result.metadata.description).toBe('用户管理');
      expect(result.metadata.group).toBe('core');
      expect(result.metadata.icon).toBe('users');
      expect(result.metadata.sortOrder).toBe(10);
    });

    it('should set displayName', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .displayName('用户管理');

      const result = builder.build();
      expect(result.metadata.displayName).toBe('用户管理');
    });

    it('should set description', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .description('用户资源和权限管理');

      const result = builder.build();
      expect(result.metadata.description).toBe('用户资源和权限管理');
    });

    it('should set group', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .group('core');

      const result = builder.build();
      expect(result.metadata.group).toBe('core');
    });

    it('should set icon', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .icon('users');

      const result = builder.build();
      expect(result.metadata.icon).toBe('users');
    });

    it('should set hidden', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .hidden();

      const result = builder.build();
      expect(result.metadata.hidden).toBe(true);
    });

    it('should add tags', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .tags('core', 'auth', 'important');

      const result = builder.build();
      expect(result.metadata.tags).toEqual(['core', 'auth', 'important']);
    });

    it('should chain metadata methods', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .displayName('用户')
        .description('用户管理')
        .group('core')
        .icon('users')
        .tags('important');

      const result = builder.build();
      expect(result.metadata.displayName).toBe('用户');
      expect(result.metadata.description).toBe('用户管理');
      expect(result.metadata.group).toBe('core');
      expect(result.metadata.tags).toContain('important');
    });
  });

  describe('ResourceBuilder - hooks', () => {
    it('should add hooks', () => {
      const beforeCreate = async (ctx: any, input: any) => input;
      const afterCreate = async (ctx: any, result: any) => {};

      const builder = resource('user', z.object({ id: z.string() }))
        .hooks({
          beforeCreate: [beforeCreate],
          afterCreate: [afterCreate],
        });

      const result = builder.build();
      expect(result.hooks.beforeCreate).toHaveLength(1);
      expect(result.hooks.afterCreate).toHaveLength(1);
    });

    it('should append hooks to existing ones', () => {
      const hook1 = async (ctx: any, input: any) => input;
      const hook2 = async (ctx: any, input: any) => input;

      const builder = resource('user', z.object({ id: z.string() }))
        .hooks({ beforeCreate: [hook1] })
        .hooks({ beforeCreate: [hook2] });

      const result = builder.build();
      expect(result.hooks.beforeCreate).toHaveLength(2);
    });

    it('should support all hook types', () => {
      const hook = async () => {};

      const builder = resource('user', z.object({ id: z.string() }))
        .hooks({
          beforeCreate: [hook],
          afterCreate: [hook],
          beforeRead: [hook],
          afterRead: [hook],
          beforeUpdate: [hook],
          afterUpdate: [hook],
          beforeDelete: [hook],
          afterDelete: [hook],
          beforeList: [hook],
          afterList: [hook],
          filterQuery: [hook],
        });

      const result = builder.build();
      expect(result.hooks.beforeCreate).toHaveLength(1);
      expect(result.hooks.afterDelete).toHaveLength(1);
      expect(result.hooks.filterQuery).toHaveLength(1);
    });
  });

  describe('ResourceBuilder - build', () => {
    it('should return ResourceDefinition', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .enable('create', 'read');

      const result = builder.build();
      expect(result.name).toBe('user');
      expect(result.features.create).toBe(true);
      expect(result.features.read).toBe(true);
    });

    it('should generate permissions from features', () => {
      const builder = resource('user', z.object({ id: z.string() }))
        .enable('create', 'read', 'update', 'delete', 'list');

      const result = builder.build();
      const actions = result.permissions.map(p => p.action);
      expect(actions).toContain('create');
      expect(actions).toContain('read');
      expect(actions).toContain('update');
      expect(actions).toContain('delete');
      expect(actions).toContain('list');
    });

    it('should generate displayName from name', () => {
      const builder = resource('userProfile', z.object({ id: z.string() }));
      const result = builder.build();

      expect(result.metadata.displayName).toBe('User Profile');
    });

    it('should generate pluralName from name', () => {
      const builder = resource('user', z.object({ id: z.string() }));
      const result = builder.build();

      expect(result.metadata.pluralName).toBe('Users');
    });
  });

  describe('ResourceBuilder - complex scenarios', () => {
    it('should build complete resource definition', () => {
      const builder = resource('user', z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
      }))
        .displayName('用户')
        .description('用户管理')
        .enable('create', 'read', 'update', 'delete', 'list')
        .action('export', '导出用户')
        .hasMany('posts', 'post', 'userId')
        .belongsTo('department', 'department', 'deptId')
        .meta({ group: 'core', icon: 'users' })
        .tags('important', 'core');

      const result = builder.build();

      expect(result.name).toBe('user');
      expect(result.metadata.displayName).toBe('用户');
      expect(result.features.create).toBe(true);
      expect(result.permissions.find(p => p.action === 'export')).toBeDefined();
      expect(result.relations.find(r => r.type === 'hasMany')).toBeDefined();
      expect(result.relations.find(r => r.type === 'belongsTo')).toBeDefined();
    });

    it('should handle read-only resource', () => {
      const builder = resource('config', z.object({ id: z.string(), key: z.string(), value: z.string() }))
        .readOnly()
        .enable('read', 'list')
        .meta({ displayName: '配置', group: 'system' });

      const result = builder.build();
      expect(result.features.create).toBe(false);
      expect(result.features.update).toBe(false);
      expect(result.features.delete).toBe(false);
      expect(result.features.read).toBe(true);
    });
  });
});
