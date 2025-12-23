import { describe, it, expect } from 'vitest';
import {
  generatePermissions,
  compilePermission,
  compileResourcePermissions,
  generatePermissionCodes,
  generateAllPermissionCodes,
} from '../permission/generate.js';

describe('Permission Generate', () => {
  describe('generatePermissions - input validation', () => {
    it('should throw for null resourceName', () => {
      expect(() => generatePermissions(null as any, { create: true })).toThrow('resourceName 必须是非空字符串');
    });

    it('should throw for empty resourceName', () => {
      expect(() => generatePermissions('', { create: true })).toThrow('resourceName 必须是非空字符串');
    });

    it('should throw for non-string resourceName', () => {
      expect(() => generatePermissions(123 as any, { create: true })).toThrow('resourceName 必须是非空字符串');
    });

    it('should throw for invalid resourceName format', () => {
      expect(() => generatePermissions('123user', { create: true })).toThrow('resourceName 必须以字母开头');
      expect(() => generatePermissions('user-name', { create: true })).toThrow('只能包含字母、数字和下划线');
    });

    it('should throw for null features', () => {
      expect(() => generatePermissions('user', null as any)).toThrow('features 必须是一个对象');
    });

    it('should throw for non-object features', () => {
      expect(() => generatePermissions('user', 'invalid' as any)).toThrow('features 必须是一个对象');
    });

    it('should throw for missing CRUD features', () => {
      expect(() => generatePermissions('user', { create: true })).toThrow('基础 CRUD 属性必须是 boolean 类型');
    });

    it('should throw for invalid advanced features type', () => {
      expect(() => generatePermissions('user', { create: true, read: true, advanced: 'invalid' as any })).toThrow();
    });

    it('should throw for invalid advanced feature value', () => {
      expect(() => generatePermissions('user', { create: true, read: true, advanced: { export: 'yes' as any } })).toThrow();
    });

    it('should throw for invalid scopeConfig', () => {
      expect(() => generatePermissions('user', { create: true, read: true }, 'invalid' as any)).toThrow();
    });
  });

  describe('generatePermissions - basic CRUD', () => {
    it('should generate create permission', () => {
      const permissions = generatePermissions('user', { create: true, read: false, update: false, delete: false, list: false });

      expect(permissions).toHaveLength(1);
      expect(permissions[0].action).toBe('create');
      expect(permissions[0].description).toBe('创建 user');
      expect(permissions[0].scope).toBe('tenant');
    });

    it('should generate read permission', () => {
      const permissions = generatePermissions('user', { create: false, read: true, update: false, delete: false, list: false });

      expect(permissions).toHaveLength(1);
      expect(permissions[0].action).toBe('read');
      expect(permissions[0].description).toBe('读取 user');
    });

    it('should generate update permission', () => {
      const permissions = generatePermissions('user', { create: false, read: false, update: true, delete: false, list: false });

      expect(permissions).toHaveLength(1);
      expect(permissions[0].action).toBe('update');
      expect(permissions[0].description).toBe('更新 user');
    });

    it('should generate delete permission', () => {
      const permissions = generatePermissions('user', { create: false, read: false, update: false, delete: true, list: false });

      expect(permissions).toHaveLength(1);
      expect(permissions[0].action).toBe('delete');
      expect(permissions[0].description).toBe('删除 user');
    });

    it('should generate list permission', () => {
      const permissions = generatePermissions('user', { create: false, read: false, update: false, delete: false, list: true });

      expect(permissions).toHaveLength(1);
      expect(permissions[0].action).toBe('list');
      expect(permissions[0].description).toBe('列出 user');
    });

    it('should generate all CRUD permissions', () => {
      const permissions = generatePermissions('user', {
        create: true,
        read: true,
        update: true,
        delete: true,
        list: true,
      });

      expect(permissions).toHaveLength(5);
      const actions = permissions.map(p => p.action);
      expect(actions).toContain('create');
      expect(actions).toContain('read');
      expect(actions).toContain('update');
      expect(actions).toContain('delete');
      expect(actions).toContain('list');
    });

    it('should use default scope when not specified', () => {
      const permissions = generatePermissions('user', { create: true, read: true, update: false, delete: false, list: false });

      expect(permissions[0].scope).toBe('tenant');
    });

    it('should allow custom scope configuration', () => {
      const permissions = generatePermissions('user', { create: true, read: true, update: false, delete: false, list: false }, {
        create: 'system',
        read: 'own',
      });

      expect(permissions.find(p => p.action === 'create')?.scope).toBe('system');
      expect(permissions.find(p => p.action === 'read')?.scope).toBe('own');
    });
  });

  describe('generatePermissions - advanced features', () => {
    it('should generate export permission', () => {
      const permissions = generatePermissions('user', {
        create: false,
        read: true,
        update: false,
        delete: false,
        list: false,
        advanced: { export: true },
      });

      expect(permissions).toHaveLength(2);
      expect(permissions.find(p => p.action === 'export')).toBeDefined();
    });

    it('should generate import permission', () => {
      const permissions = generatePermissions('user', {
        create: false,
        read: false,
        update: false,
        delete: false,
        list: false,
        advanced: { import: true },
      });

      expect(permissions.find(p => p.action === 'import')).toBeDefined();
    });

    it('should generate bulk permission', () => {
      const permissions = generatePermissions('user', {
        create: false,
        read: false,
        update: false,
        delete: false,
        list: false,
        advanced: { bulk: true },
      });

      expect(permissions.find(p => p.action === 'bulk')).toBeDefined();
    });

    it('should generate softDelete permission', () => {
      const permissions = generatePermissions('user', {
        create: false,
        read: false,
        update: false,
        delete: false,
        list: false,
        advanced: { softDelete: true },
      });

      expect(permissions.find(p => p.action === 'softDelete')).toBeDefined();
    });

    it('should generate versioning permission', () => {
      const permissions = generatePermissions('user', {
        create: false,
        read: false,
        update: false,
        delete: false,
        list: false,
        advanced: { versioning: true },
      });

      expect(permissions.find(p => p.action === 'versioning')).toBeDefined();
    });

    it('should skip undefined advanced features', () => {
      const permissions = generatePermissions('user', {
        create: false,
        read: false,
        update: false,
        delete: false,
        list: false,
        advanced: { export: true, import: undefined },
      });

      expect(permissions.find(p => p.action === 'export')).toBeDefined();
      expect(permissions.find(p => p.action === 'import')).toBeUndefined();
    });
  });

  describe('compilePermission - input validation', () => {
    it('should throw for null resourceName', () => {
      expect(() => compilePermission(null as any, { action: 'read' })).toThrow('resourceName 必须是非空字符串');
    });

    it('should throw for invalid resourceName format', () => {
      expect(() => compilePermission('123user', { action: 'read' })).toThrow('resourceName 必须以字母开头');
    });

    it('should throw for null definition', () => {
      expect(() => compilePermission('user', null as any)).toThrow('definition 必须是一个对象');
    });

    it('should throw for non-object definition', () => {
      expect(() => compilePermission('user', 'invalid' as any)).toThrow('definition 必须是一个对象');
    });

    it('should throw for missing action', () => {
      expect(() => compilePermission('user', {} as any)).toThrow('definition.action 必须是非空字符串');
    });

    it('should throw for empty action', () => {
      expect(() => compilePermission('user', { action: '' })).toThrow('definition.action 必须是非空字符串');
    });

    it('should throw for invalid action format', () => {
      expect(() => compilePermission('user', { action: '123action' })).toThrow('definition.action 必须以字母开头');
    });

    it('should throw for non-string scope', () => {
      expect(() => compilePermission('user', { action: 'read', scope: 123 as any })).toThrow('definition.scope 必须是字符串');
    });

    it('should throw for non-string description', () => {
      expect(() => compilePermission('user', { action: 'read', description: 123 as any })).toThrow('definition.description 必须是字符串');
    });

    it('should throw for non-array conditions', () => {
      expect(() => compilePermission('user', { action: 'read', conditions: {} as any })).toThrow('definition.conditions 必须是一个数组');
    });

    it('should throw for non-object metadata', () => {
      expect(() => compilePermission('user', { action: 'read', metadata: 'invalid' as any })).toThrow('definition.metadata 必须是一个对象');
    });
  });

  describe('compilePermission - compilation', () => {
    it('should compile permission with correct structure', () => {
      const permission = compilePermission('user', { action: 'read', description: '读取用户' });

      expect(permission.code).toBe('user:read');
      expect(permission.resource).toBe('user');
      expect(permission.action).toBe('read');
      expect(permission.scope).toBe('tenant');
      expect(permission.description).toBe('读取用户');
      expect(permission.conditions).toEqual([]);
      expect(permission.metadata).toEqual({});
    });

    it('should use custom scope when provided', () => {
      const permission = compilePermission('user', { action: 'read', scope: 'own' });

      expect(permission.scope).toBe('own');
    });

    it('should use custom description when provided', () => {
      const permission = compilePermission('user', { action: 'read', description: 'Custom description' });

      expect(permission.description).toBe('Custom description');
    });

    it('should preserve conditions when provided', () => {
      const conditions = [{ type: 'field' as const, field: 'subject.role', operator: 'eq' as const, value: 'admin' }];
      const permission = compilePermission('user', { action: 'read', conditions });

      expect(permission.conditions).toEqual(conditions);
    });

    it('should preserve metadata when provided', () => {
      const metadata = { group: 'admin', important: true };
      const permission = compilePermission('user', { action: 'read', metadata });

      expect(permission.metadata).toEqual(metadata);
    });
  });

  describe('compileResourcePermissions - input validation', () => {
    it('should throw for null resourceName', () => {
      expect(() => compileResourcePermissions(null as any, [{ action: 'read' }])).toThrow('resourceName 必须是非空字符串');
    });

    it('should throw for invalid resourceName format', () => {
      expect(() => compileResourcePermissions('123user', [{ action: 'read' }])).toThrow('resourceName 必须以字母开头');
    });

    it('should throw for non-array definitions', () => {
      expect(() => compileResourcePermissions('user', {} as any)).toThrow('definitions 必须是一个数组');
    });

    it('should throw for empty definitions array', () => {
      expect(() => compileResourcePermissions('user', [])).toThrow('definitions 不能为空数组');
    });

    it('should throw for non-object definition at index', () => {
      expect(() => compileResourcePermissions('user', ['invalid' as any])).toThrow('definitions[0] 必须是一个对象');
    });

    it('should throw for missing action in definition', () => {
      expect(() => compileResourcePermissions('user', [{} as any])).toThrow('definitions[0].action 必须是非空字符串');
    });
  });

  describe('compileResourcePermissions - compilation', () => {
    it('should compile multiple permissions', () => {
      const permissions = compileResourcePermissions('user', [
        { action: 'read', description: '读取' },
        { action: 'write', description: '写入' },
      ]);

      expect(permissions).toHaveLength(2);
      expect(permissions[0].code).toBe('user:read');
      expect(permissions[1].code).toBe('user:write');
    });

    it('should use resourceName in all permissions', () => {
      const permissions = compileResourcePermissions('order', [
        { action: 'create' },
        { action: 'read' },
      ]);

      expect(permissions[0].resource).toBe('order');
      expect(permissions[1].resource).toBe('order');
    });
  });

  describe('generatePermissionCodes - input validation', () => {
    it('should throw for null resourceName', () => {
      expect(() => generatePermissionCodes(null as any, ['read'])).toThrow('resourceName 必须是非空字符串');
    });

    it('should throw for invalid resourceName format', () => {
      expect(() => generatePermissionCodes('123user', ['read'])).toThrow('resourceName 必须以字母开头');
    });

    it('should throw for non-array actions', () => {
      expect(() => generatePermissionCodes('user', 'read' as any)).toThrow('actions 必须是一个数组');
    });

    it('should throw for empty actions array', () => {
      expect(() => generatePermissionCodes('user', [])).toThrow('actions 不能为空数组');
    });

    it('should throw for non-string action at index', () => {
      expect(() => generatePermissionCodes('user', [123 as any])).toThrow('actions[0] 必须是非空字符串');
    });

    it('should throw for invalid action format', () => {
      expect(() => generatePermissionCodes('user', ['123action'])).toThrow('actions[0] 必须以字母开头');
    });
  });

  describe('generatePermissionCodes - code generation', () => {
    it('should generate permission codes object', () => {
      const codes = generatePermissionCodes('user', ['create', 'read', 'update']);

      expect(codes).toEqual({
        USER_CREATE: 'user:create',
        USER_READ: 'user:read',
        USER_UPDATE: 'user:update',
      });
    });

    it('should handle single action', () => {
      const codes = generatePermissionCodes('order', ['list']);

      expect(codes).toEqual({
        ORDER_LIST: 'order:list',
      });
    });

    it('should uppercase action names in keys', () => {
      const codes = generatePermissionCodes('product', ['bulkCreate']);

      expect(codes).toHaveProperty('PRODUCT_BULKCREATE');
    });

    it('should handle special characters in actions', () => {
      const codes = generatePermissionCodes('user', ['custom_action']);

      expect(codes).toEqual({
        USER_CUSTOM_ACTION: 'user:custom_action',
      });
    });
  });

  describe('generateAllPermissionCodes - input validation', () => {
    it('should throw for non-array resources', () => {
      expect(() => generateAllPermissionCodes(null as any)).toThrow('resources 必须是一个数组');
    });

    it('should throw for empty resources array', () => {
      expect(() => generateAllPermissionCodes([])).toThrow('resources 不能为空数组');
    });

    it('should throw for non-object resource at index', () => {
      expect(() => generateAllPermissionCodes(['invalid' as any])).toThrow('resources[0] 必须是一个对象');
    });

    it('should throw for missing resource name', () => {
      expect(() => generateAllPermissionCodes([{ permissions: [] } as any])).toThrow('resources[0].name 必须是非空字符串');
    });

    it('should throw for invalid resource name format', () => {
      expect(() => generateAllPermissionCodes([{ name: '123test', permissions: [] } as any])).toThrow('resources[0].name 必须以字母开头');
    });

    it('should throw for missing permissions', () => {
      expect(() => generateAllPermissionCodes([{ name: 'user' } as any])).toThrow('resources[0].permissions 必须是一个数组');
    });

    it('should throw for empty permissions', () => {
      expect(() => generateAllPermissionCodes([{ name: 'user', permissions: [] } as any])).toThrow('resources[0].permissions 不能为空数组');
    });

    it('should throw for invalid permission at index', () => {
      expect(() => generateAllPermissionCodes([{ name: 'user', permissions: [{}] } as any])).toThrow('resources[0].permissions[0].action 必须是非空字符串');
    });
  });

  describe('generateAllPermissionCodes - aggregation', () => {
    it('should aggregate codes from multiple resources', () => {
      const codes = generateAllPermissionCodes([
        { name: 'user', permissions: [{ action: 'read' }, { action: 'write' }] },
        { name: 'order', permissions: [{ action: 'create' }, { action: 'list' }] },
      ]);

      expect(codes).toEqual({
        USER_READ: 'user:read',
        USER_WRITE: 'user:write',
        ORDER_CREATE: 'order:create',
        ORDER_LIST: 'order:list',
      });
    });

    it('should handle single resource', () => {
      const codes = generateAllPermissionCodes([
        { name: 'user', permissions: [{ action: 'read' }] },
      ]);

      expect(codes).toEqual({
        USER_READ: 'user:read',
      });
    });

    it('should handle multiple permissions per resource', () => {
      const codes = generateAllPermissionCodes([
        { name: 'user', permissions: [{ action: 'create' }, { action: 'read' }, { action: 'update' }, { action: 'delete' }] },
      ]);

      expect(Object.keys(codes)).toHaveLength(4);
    });
  });

  describe('Permission code format', () => {
    it('should format permission code as resource:action', () => {
      const permission = compilePermission('user', { action: 'create' });
      expect(permission.code).toBe('user:create');
    });

    it('should preserve case in resource names', () => {
      const permission = compilePermission('userProfile', { action: 'read' });
      expect(permission.code).toBe('userProfile:read');
    });

    it('should preserve case in action names', () => {
      const permission = compilePermission('user', { action: 'bulkCreate' });
      expect(permission.code).toBe('user:bulkCreate');
    });
  });
});
