import { and, eq, or } from 'drizzle-orm';
import type {
  EffectivePermissions,
  RBACStore,
  RoleBinding,
  RoleDefinition,
} from '@mtpc/rbac';
import { db } from '../db/connection.js';
import { roleBindings, roles, type Role, type RoleBinding as DbRoleBinding } from '../db/rbac-schema.js';

/**
 * 数据库 RBAC 存储实现
 *
 * 使用 Drizzle ORM 将角色和绑定数据持久化到 PostgreSQL 数据库
 *
 * 特性：
 * - 支持多租户隔离
 * - 支持角色继承
 * - 支持临时权限（过期时间）
 * - 支持系统角色保护
 */
export class DatabaseRBACStore implements RBACStore {
  /**
   * 将数据库行转换为 RoleDefinition
   */
  private dbRoleToRoleDefinition(row: Role): RoleDefinition {
    return {
      id: row.id,
      roleId: row.name,
      tenantId: row.tenantId,
      displayName: row.displayName ?? row.name,
      description: row.description ?? '',
      permissions: new Set(row.permissions),
      inherits: new Set(row.inherits || []),
      isSystem: row.isSystem ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
    };
  }

  /**
   * 将 RoleDefinition 转换为数据库行
   */
  private roleDefinitionToDbRole(role: RoleDefinition): Partial<Role> {
    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.roleId,
      displayName: role.displayName,
      description: role.description,
      permissions: Array.from(role.permissions),
      inherits: role.inherits ? Array.from(role.inherits) : [],
      isSystem: role.isSystem ?? false,
      createdBy: role.createdBy,
      updatedBy: role.updatedBy,
    };
  }

  /**
   * 将数据库绑定行转换为 RoleBinding
   */
  private dbBindingToRoleBinding(row: DbRoleBinding): RoleBinding {
    return {
      id: row.id,
      tenantId: row.tenantId,
      roleId: row.roleId,
      subjectType: row.subjectType as 'user' | 'group' | 'service',
      subjectId: row.subjectId,
      expiresAt: row.expiresAt ?? undefined,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
    };
  }

  // ============== 角色操作 ==============

  async getRole(tenantId: string, roleId: string): Promise<RoleDefinition | null> {
    const result = await db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.name, roleId)))
      .limit(1);

    if (result.length === 0) return null;
    return this.dbRoleToRoleDefinition(result[0]);
  }

  async listRoles(tenantId: string): Promise<RoleDefinition[]> {
    const result = await db.select().from(roles).where(eq(roles.tenantId, tenantId));
    return result.map(row => this.dbRoleToRoleDefinition(row));
  }

  async createRole(tenantId: string, role: RoleDefinition): Promise<void> {
    const data = this.roleDefinitionToDbRole(role);
    await db.insert(roles).values({
      ...data,
      tenantId,
    });
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    updates: Partial<RoleDefinition>
  ): Promise<void> {
    const data: Partial<Role> = {};

    if (updates.displayName !== undefined) {
      data.displayName = updates.displayName;
    }
    if (updates.description !== undefined) {
      data.description = updates.description;
    }
    if (updates.permissions !== undefined) {
      data.permissions = Array.from(updates.permissions);
    }
    if (updates.inherits !== undefined) {
      data.inherits = Array.from(updates.inherits);
    }
    if (updates.updatedBy !== undefined) {
      data.updatedBy = updates.updatedBy;
    }

    data.updatedAt = new Date();

    await db
      .update(roles)
      .set(data)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.name, roleId)));
  }

  async deleteRole(tenantId: string, roleId: string): Promise<void> {
    await db
      .delete(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.name, roleId)));
  }

  async registerSystemRole(role: RoleDefinition): Promise<void> {
    // 检查是否已存在
    const existing = await this.getRole(role.tenantId, role.roleId);
    if (existing) {
      // 更新系统角色
      await this.updateRole(role.tenantId, role.roleId, role);
    } else {
      // 创建系统角色
      await this.createRole(role.tenantId, role);
    }
  }

  // ============== 绑定操作 ==============

  async getBinding(
    tenantId: string,
    roleId: string,
    subjectType: string,
    subjectId: string
  ): Promise<RoleBinding | null> {
    const result = await db
      .select()
      .from(roleBindings)
      .where(
        and(
          eq(roleBindings.tenantId, tenantId),
          eq(roleBindings.roleId, roleId),
          eq(roleBindings.subjectType, subjectType),
          eq(roleBindings.subjectId, subjectId)
        )
      )
      .limit(1);

    if (result.length === 0) return null;
    return this.dbBindingToRoleBinding(result[0]);
  }

  async listBindings(
    tenantId: string,
    subjectType: string,
    subjectId: string
  ): Promise<RoleBinding[]> {
    const result = await db
      .select()
      .from(roleBindings)
      .where(
        and(
          eq(roleBindings.tenantId, tenantId),
          eq(roleBindings.subjectType, subjectType),
          eq(roleBindings.subjectId, subjectId)
        )
      );

    return result.map(row => this.dbBindingToRoleBinding(row));
  }

  async createBinding(tenantId: string, binding: RoleBinding): Promise<void> {
    await db.insert(roleBindings).values({
      id: binding.id,
      tenantId: binding.tenantId,
      roleId: binding.roleId,
      subjectType: binding.subjectType,
      subjectId: binding.subjectId,
      expiresAt: binding.expiresAt,
      createdBy: binding.createdBy,
    });
  }

  async deleteBinding(
    tenantId: string,
    roleId: string,
    subjectType: string,
    subjectId: string
  ): Promise<void> {
    await db
      .delete(roleBindings)
      .where(
        and(
          eq(roleBindings.tenantId, tenantId),
          eq(roleBindings.roleId, roleId),
          eq(roleBindings.subjectType, subjectType),
          eq(roleBindings.subjectId, subjectId)
        )
      );
  }

  async updateBinding(
    tenantId: string,
    roleId: string,
    subjectType: string,
    subjectId: string,
    updates: Partial<RoleBinding>
  ): Promise<void> {
    const data: Partial<DbRoleBinding> = {};

    if (updates.expiresAt !== undefined) {
      data.expiresAt = updates.expiresAt;
    }

    await db
      .update(roleBindings)
      .set(data)
      .where(
        and(
          eq(roleBindings.tenantId, tenantId),
          eq(roleBindings.roleId, roleId),
          eq(roleBindings.subjectType, subjectType),
          eq(roleBindings.subjectId, subjectId)
        )
      );
  }

  // ============== 权限查询 ==============

  async getRoleByName(tenantId: string, name: string): Promise<RoleDefinition | null> {
    return this.getRole(tenantId, name);
  }

  async getSubjectBindings(
    tenantId: string,
    subjectType: string,
    subjectId: string
  ): Promise<RoleBinding[]> {
    return this.listBindings(tenantId, subjectType, subjectId);
  }

  async invalidatePermissions(tenantId: string, subjectId?: string): Promise<void> {
    // 在实际实现中，这里可以清除缓存
    // 由于示例中使用的是内存缓存，RBAC 评估器会自动处理
    return Promise.resolve();
  }

  async getEffectivePermissions(
    tenantId: string,
    subjectType: string,
    subjectId: string
  ): Promise<EffectivePermissions> {
    // 获取所有绑定
    const bindings = await this.listBindings(tenantId, subjectType, subjectId);

    // 过滤有效绑定（未过期）
    const now = new Date();
    const validBindings = bindings.filter(b => !b.expiresAt || b.expiresAt > now);

    // 收集所有角色
    const roleIds = new Set<string>();
    for (const binding of validBindings) {
      roleIds.add(binding.roleId);
    }

    // 获取所有角色的权限（包括继承的权限）
    const permissions = new Set<string>();
    const processedRoles = new Set<string>();
    const rolesToProcess = Array.from(roleIds);

    while (rolesToProcess.length > 0) {
      const roleId = rolesToProcess.shift()!;

      if (processedRoles.has(roleId)) {
        continue;
      }
      processedRoles.add(roleId);

      const role = await this.getRole(tenantId, roleId);
      if (role) {
        // 添加角色权限
        for (const permission of role.permissions) {
          permissions.add(permission);
        }

        // 添加继承的角色到处理队列
        if (role.inherits) {
          for (const inheritedRoleId of role.inherits) {
            if (!processedRoles.has(inheritedRoleId)) {
              rolesToProcess.push(inheritedRoleId);
            }
          }
        }
      }
    }

    return {
      permissions,
      roles: Array.from(roleIds),
      bindings: validBindings,
    };
  }
}
