import type { MTPCContext } from '@mtpc/core';
import { getByPath } from '@mtpc/shared';

/**
 * 从上下文按路径解析值
 */
export function resolveFromContext(ctx: MTPCContext, path: string): unknown {
  return getByPath(ctx as unknown as Record<string, unknown>, path);
}

/**
 * 为上下文路径创建解析器函数
 */
export function createContextResolver(path: string): (ctx: MTPCContext) => unknown {
  return ctx => resolveFromContext(ctx, path);
}

/**
 * 通用上下文解析器
 */
export const contextResolvers = {
  /**
   * 获取主体 ID
   */
  subjectId: (ctx: MTPCContext): string => ctx.subject.id,

  /**
   * 获取租户 ID
   */
  tenantId: (ctx: MTPCContext): string => ctx.tenant.id,

  /**
   * 获取主体类型
   */
  subjectType: (ctx: MTPCContext): string => ctx.subject.type,

  /**
   * 获取主体角色
   */
  roles: (ctx: MTPCContext): string[] => ctx.subject.roles ?? [],

  /**
   * 获取主体权限
   */
  permissions: (ctx: MTPCContext): string[] => ctx.subject.permissions ?? [],

  /**
   * 从元数据获取部门 ID
   */
  departmentId: (ctx: MTPCContext): unknown => ctx.subject.metadata?.departmentId,

  /**
   * 从元数据获取团队 ID
   */
  teamId: (ctx: MTPCContext): unknown => ctx.subject.metadata?.teamId,

  /**
   * 从元数据获取组织 ID
   */
  organizationId: (ctx: MTPCContext): unknown => ctx.subject.metadata?.organizationId,

  /**
   * 检查主体是否为管理员
   * @deprecated 使用 createAdminChecker 创建自定义管理员检查器
   */
  isAdmin: (ctx: MTPCContext): boolean => ctx.subject.roles?.includes('admin') ?? false,

  /**
   * 检查主体是否为系统
   */
  isSystem: (ctx: MTPCContext): boolean => ctx.subject.type === 'system',
};

/**
 * 检查主体是否有通配符权限
 */
export function hasWildcardPermission(ctx: MTPCContext): boolean {
  const permissions = ctx.subject.permissions ?? [];
  return permissions.includes('*');
}

/**
 * 创建管理员检查器
 * @param adminRoles 管理员角色名称列表，默认为 ['admin']
 * @param checkWildcard 是否检查通配符权限，默认为 true
 */
export function createAdminChecker(
  adminRoles: string[] = ['admin'],
  checkWildcard: boolean = true
): (ctx: MTPCContext) => boolean {
  return (ctx: MTPCContext) => {
    // 检查通配符权限
    if (checkWildcard && hasWildcardPermission(ctx)) {
      return true;
    }

    // 检查管理员角色
    const roles = ctx.subject.roles ?? [];
    return adminRoles.some(role => roles.includes(role));
  };
}

/**
 * 创建元数据解析器
 */
export function createMetadataResolver(key: string): (ctx: MTPCContext) => unknown {
  return ctx => ctx.subject.metadata?.[key];
}

/**
 * 创建角色检查器
 */
export function createRoleChecker(role: string): (ctx: MTPCContext) => boolean {
  return ctx => ctx.subject.roles?.includes(role) ?? false;
}

/**
 * 创建多角色检查器（任意）
 */
export function createAnyRoleChecker(roles: string[]): (ctx: MTPCContext) => boolean {
  return ctx => roles.some(role => ctx.subject.roles?.includes(role));
}

/**
 * 创建多角色检查器（全部）
 */
export function createAllRolesChecker(roles: string[]): (ctx: MTPCContext) => boolean {
  return ctx => roles.every(role => ctx.subject.roles?.includes(role));
}
