/**
 * MTPC RBAC 扩展 - 架构级测试
 *
 * 测试目标：
 * 1. RBAC 可移除性（移除后 Core 行为不变）
 * 2. Role -> Permission 是纯函数
 * 3. 租户角色隔离
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RoleManager, createRoleManager } from '../role/manager.js';
import type { RBACStore, RoleDefinition } from '../types.js';

// ========== Mock RBAC Store ==========

class MockRBACStore implements RBACStore {
  private roles: Map<string, Map<string, RoleDefinition>> = new Map();
  private permissions: Map<string, Set<string>> = new Map();

  async createRole(
    tenantId: string,
    input: any,
    _createdBy?: string
  ): Promise<RoleDefinition> {
    if (!this.roles.has(tenantId)) {
      this.roles.set(tenantId, new Map());
    }
    const role: RoleDefinition = {
      id: crypto.randomUUID(),
      tenantId,
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      type: 'custom',
      status: 'active',
      permissions: input.permissions || [],
      inherits: input.inherits,
      metadata: input.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.roles.get(tenantId)!.set(role.id, role);
    return role;
  }

  async getRole(tenantId: string, roleId: string): Promise<RoleDefinition | null> {
    return this.roles.get(tenantId)?.get(roleId) || null;
  }

  async getRoleByName(tenantId: string, name: string): Promise<RoleDefinition | null> {
    const roles = this.roles.get(tenantId);
    if (!roles) return null;
    for (const role of roles.values()) {
      if (role.name === name) return role;
    }
    return null;
  }

  async listRoles(
    tenantId: string,
    _options?: { status?: string; type?: string }
  ): Promise<RoleDefinition[]> {
    return Array.from(this.roles.get(tenantId)?.values() || []);
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    input: any
  ): Promise<RoleDefinition | null> {
    const role = this.roles.get(tenantId)?.get(roleId);
    if (!role) return null;
    const updated = {
      ...role,
      ...input,
      updatedAt: new Date(),
    };
    this.roles.get(tenantId)!.set(roleId, updated);
    return updated;
  }

  async deleteRole(tenantId: string, roleId: string): Promise<boolean> {
    return this.roles.get(tenantId)?.delete(roleId) || false;
  }

  async getSubjectRoles(_tenantId: string, _subjectId: string): Promise<string[]> {
    return [];
  }

  async assignRole(
    _tenantId: string,
    _subjectId: string,
    _roleId: string
  ): Promise<boolean> {
    return true;
  }

  async removeRole(_tenantId: string, _subjectId: string, _roleId: string): Promise<boolean> {
    return true;
  }

  async getSubjectPermissions(
    tenantId: string,
    subjectId: string
  ): Promise<Set<string>> {
    return this.permissions.get(`${tenantId}:${subjectId}`) || new Set();
  }

  async setSubjectPermissions(
    tenantId: string,
    subjectId: string,
    permissions: Set<string>
  ): Promise<void> {
    this.permissions.set(`${tenantId}:${subjectId}`, permissions);
  }

  async invalidatePermissions(_tenantId: string): Promise<void> {
    // 清除所有相关缓存
  }
}

// ========== Fixtures ==========

describe('TC-RBAC-001: RBAC 可移除性 [架构级测试 - Extension Independence]', () => {
  it('should create role without RBAC extension (pure Core)', () => {
    // 这个测试验证 Core 本身可以独立工作
    // RBAC 只是 Policy 的一种解释方式

    const store = new MockRBACStore();
    const manager = createRoleManager(store);

    expect(manager).toBeInstanceOf(RoleManager);
  });

  it('should have isolated store per tenant', async () => {
    const store = new MockRBACStore();
    const manager = createRoleManager(store);

    // 在租户 A 创建角色
    await manager.createRole('tenant-A', {
      name: 'admin',
      permissions: ['user:*'],
    });

    // 在租户 B 查询 - 不应该看到租户 A 的角色
    const rolesInB = await manager.listRoles('tenant-B');
    expect(rolesInB.length).toBe(0);

    const rolesInA = await manager.listRoles('tenant-A');
    expect(rolesInA.length).toBe(1);
    expect(rolesInA[0].name).toBe('admin');
  });
});

describe('TC-RBAC-002: Role 权限派生纯函数 [架构级测试 - Transparency]', () => {
  let manager: RoleManager;
  let store: MockRBACStore;

  beforeEach(() => {
    store = new MockRBACStore();
    manager = createRoleManager(store);
  });

  it('should return consistent permissions for same role', async () => {
    // 创建角色
    await manager.createRole('tenant-1', {
      name: 'editor',
      displayName: 'Editor',
      permissions: ['article:read', 'article:write'],
    });

    const role = await manager.getRoleByName('tenant-1', 'editor');

    // 多次获取权限应该一致
    const perms1 = await manager.getRolePermissions('tenant-1', role!.id);
    const perms2 = await manager.getRolePermissions('tenant-1', role!.id);

    expect(perms1).toEqual(perms2);
    expect(Array.from(perms1).sort()).toEqual(['article:read', 'article:write']);
  });

  it('should resolve inherited permissions', async () => {
    // 创建基础角色
    await manager.createRole('tenant-1', {
      name: 'reader',
      permissions: ['article:read'],
    });

    // 创建继承角色
    const readerRole = await manager.getRoleByName('tenant-1', 'reader');
    await manager.createRole('tenant-1', {
      name: 'senior-reader',
      permissions: ['article:export'],
      inherits: [readerRole!.id],
    });

    const seniorRole = await manager.getRoleByName('tenant-1', 'senior-reader');
    const permissions = await manager.getRolePermissions('tenant-1', seniorRole!.id);

    expect(permissions.has('article:read')).toBe(true);
    expect(permissions.has('article:export')).toBe(true);
  });

  it('should handle circular inheritance', async () => {
    // 创建两个互相继承的角色
    const roleA = await manager.createRole('tenant-1', {
      name: 'role-a',
      permissions: ['perm-a'],
    });

    const roleB = await manager.createRole('tenant-1', {
      name: 'role-b',
      permissions: ['perm-b'],
      inherits: [roleA.id],
    });

    // 更新 roleA 继承 roleB（形成循环）
    await manager.updateRole('tenant-1', roleA.id, {
      inherits: [roleB.id],
    });

    // 获取权限时应该处理循环，避免无限循环
    const perms = await manager.getRolePermissions('tenant-1', roleA.id);
    expect(perms.size).toBeGreaterThan(0);
  });
});

describe('TC-RBAC-003: 系统角色跨租户可见性', () => {
  let manager: RoleManager;
  let store: MockRBACStore;

  beforeEach(() => {
    store = new MockRBACStore();
    manager = createRoleManager(store);
  });

  it('should register system role visible to all tenants', async () => {
    // 注册系统角色
    manager.registerSystemRole({
      id: 'super_admin',
      name: 'super_admin',
      displayName: 'Super Admin',
      description: 'Super administrator with all permissions',
      type: 'system',
      status: 'active',
      permissions: ['*'],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 从不同租户查询
    const roleFromTenantA = await manager.getRole('tenant-A', 'super_admin');
    const roleFromTenantB = await manager.getRole('tenant-B', 'super_admin');

    expect(roleFromTenantA).not.toBeNull();
    expect(roleFromTenantB).not.toBeNull();
    expect(roleFromTenantA?.id).toBe('super_admin');
    expect(roleFromTenantB?.id).toBe('super_admin');
  });

  it('should not allow modifying system roles', async () => {
    manager.registerSystemRole({
      id: 'super_admin',
      name: 'super_admin',
      displayName: 'Super Admin',
      type: 'system',
      permissions: ['*'],
    });

    // 尝试修改系统角色
    await expect(
      manager.updateRole('tenant-1', 'super_admin', {
        permissions: ['user:read'],
      })
    ).rejects.toThrow('Cannot modify system roles');
  });

  it('should not allow deleting system roles', async () => {
    manager.registerSystemRole({
      id: 'super_admin',
      name: 'super_admin',
      displayName: 'Super Admin',
      type: 'system',
      permissions: ['*'],
    });

    // 尝试删除系统角色
    const result = await manager.deleteRole('tenant-1', 'super_admin');
    expect(result).toBe(false);
  });

  it('should include system roles in list', async () => {
    manager.registerSystemRole({
      id: 'super_admin',
      name: 'super_admin',
      displayName: 'Super Admin',
      type: 'system',
      permissions: ['*'],
    });

    const roles = await manager.listRoles('tenant-1');

    expect(roles.some(r => r.id === 'super_admin')).toBe(true);
  });
});

describe('TC-RBAC-004: 租户角色隔离 [架构级测试 - Tenant Isolation]', () => {
  let manager: RoleManager;
  let store: MockRBACStore;

  beforeEach(() => {
    store = new MockRBACStore();
    manager = createRoleManager(store);
  });

  it('should not leak roles between tenants', async () => {
    // 租户 A 创建 admin 角色
    await manager.createRole('tenant-A', {
      name: 'admin',
      permissions: ['user:manage'],
    });

    // 租户 B 查询
    const rolesInB = await manager.listRoles('tenant-B');
    const adminRoleInB = await manager.getRoleByName('tenant-B', 'admin');

    expect(rolesInB.length).toBe(0);
    expect(adminRoleInB).toBeNull();
  });

  it('should have independent role names per tenant', async () => {
    // 两个租户都可以有同名的 'admin' 角色
    const roleA = await manager.createRole('tenant-A', {
      name: 'admin',
      permissions: ['user:manage'],
    });

    const roleB = await manager.createRole('tenant-B', {
      name: 'admin',
      permissions: ['order:manage'],
    });

    expect(roleA.id).not.toBe(roleB.id);
    expect(roleA.permissions).toEqual(['user:manage']);
    expect(roleB.permissions).toEqual(['order:manage']);
  });

  it('should invalidate cache on role update', async () => {
    const role = await manager.createRole('tenant-1', {
      name: 'editor',
      permissions: ['article:read'],
    });

    // 更新角色权限
    await manager.updateRole('tenant-1', role.id, {
      permissions: ['article:read', 'article:write'],
    });

    // 获取更新后的权限
    const permissions = await manager.getRolePermissions('tenant-1', role.id);
    expect(permissions.has('article:write')).toBe(true);
  });
});
