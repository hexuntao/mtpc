import type { MTPC } from '@mtpc/core';
import { createPermissionCode, PermissionDeniedError, parsePermissionCode } from '@mtpc/shared';
import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { getSubject, getTenant } from '../context/mtpc-context.js';
import type { DynamicPermissionResolver, MTPCEnv } from '../types.js';

/**
 * 权限检查中间件
 * 要求用户拥有指定的权限才能访问路由
 *
 * **支持两种调用方式**：
 * 1. 传递完整的权限码：`requirePermission('user:read')`
 * 2. 分别传递资源和操作：`requirePermission('user', 'read')`
 *
 * @param resourceOrCode - 资源名称或完整权限码
 * @param action - 操作类型（当 resourceOrCode 为资源名时使用）
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * // 方式1：完整权限码
 * app.get('/users', requirePermission('user:read'), listUsers);
 *
 * // 方式2：资源名 + 操作
 * app.get('/users', requirePermission('user', 'read'), listUsers);
 *
 * // 创建操作
 * app.post('/users', requirePermission('user', 'create'), createUser);
 * ```
 */
export function requirePermission(
  resourceOrCode: string,
  action?: string
): MiddlewareHandler<MTPCEnv> {
  return createMiddleware<MTPCEnv>(async (c, next) => {
    const mtpc = c.get('mtpc') as MTPC;

    // 确保 MTPC 已初始化
    if (!mtpc) {
      throw new Error('MTPC not initialized. Use mtpcMiddleware first.');
    }

    const tenant = getTenant(c);
    const subject = getSubject(c);

    // 解析权限参数
    // 支持两种格式：'user:read' 或 ('user', 'read')
    let resource: string;
    let permAction: string;

    if (action) {
      // 两个参数：资源名和操作
      resource = resourceOrCode;
      permAction = action;
    } else {
      // 一个参数：完整权限码，需要解析
      const parsed = parsePermissionCode(resourceOrCode);
      if (!parsed) {
        throw new Error(`Invalid permission code: ${resourceOrCode}`);
      }
      resource = parsed.resource;
      permAction = parsed.action;
    }

    // 执行权限检查
    const result = await mtpc.checkPermission({
      tenant,
      subject,
      resource,
      action: permAction,
    });

    // 权限检查失败：抛出错误
    if (!result.allowed) {
      throw new PermissionDeniedError(createPermissionCode(resource, permAction), {
        reason: result.reason,
      });
    }

    await next();
  });
}

/**
 * 要求用户拥有至少一个指定权限（OR 逻辑）
 * 只要有一个权限通过检查就允许访问
 *
 * **特点**：
 * - 按顺序检查权限，找到第一个通过的即返回
 * - 无效的权限码会被跳过（静默忽略）
 * - 所有权限都失败时才抛出错误
 *
 * @param permissionCodes - 权限码列表
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * // 用户拥有 user:read 或 user:admin 任一权限即可访问
 * app.get('/users', requireAnyPermission('user:read', 'user:admin'), listUsers);
 *
 * // 支持多种权限来源
 * app.delete('/documents/:id',
 *   requireAnyPermission('document:delete', 'document:manage', 'admin:all'),
 *   deleteDocument
 * );
 * ```
 */
export function requireAnyPermission(...permissionCodes: string[]): MiddlewareHandler<MTPCEnv> {
  return createMiddleware<MTPCEnv>(async (c, next) => {
    const mtpc = c.get('mtpc') as MTPC;

    if (!mtpc) {
      throw new Error('MTPC not initialized. Use mtpcMiddleware first.');
    }

    const tenant = getTenant(c);
    const subject = getSubject(c);

    // 遍历所有权限码，找到第一个通过的
    for (const code of permissionCodes) {
      const parsed = parsePermissionCode(code);

      // 无效的权限码被跳过（继续检查下一个）
      // 这样设计是为了容错：如果某个权限码格式错误，不会导致整个检查失败
      if (!parsed) {
        continue;
      }

      const result = await mtpc.checkPermission({
        tenant,
        subject,
        resource: parsed.resource,
        action: parsed.action,
      });

      // 找到一个通过的权限：立即放行
      if (result.allowed) {
        await next();
        return;
      }
    }

    // 所有权限都失败：抛出错误
    throw new PermissionDeniedError(permissionCodes.join(' OR '), {
      reason: 'None of the required permissions granted',
    });
  });
}

/**
 * 要求用户拥有所有指定的权限（AND 逻辑）
 * 只有当所有权限都通过检查时才允许访问
 *
 * **修复说明**：无效的权限码会立即抛出错误，而非静默跳过
 * 这样可以及时发现配置错误，避免安全隐患
 *
 * @param permissionCodes - 权限码列表，格式如 'user:read' 或 'user:create'
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * // 用户必须同时拥有读取和删除权限
 * app.delete('/users/:id', requireAllPermissions('user:read', 'user:delete'), handler);
 * ```
 */
export function requireAllPermissions(...permissionCodes: string[]): MiddlewareHandler<MTPCEnv> {
  return createMiddleware<MTPCEnv>(async (c, next) => {
    const mtpc = c.get('mtpc') as MTPC;

    if (!mtpc) {
      throw new Error('MTPC not initialized. Use mtpcMiddleware first.');
    }

    const tenant = getTenant(c);
    const subject = getSubject(c);

    // 逐个检查所有权限，任何一个失败则立即抛出错误
    for (const code of permissionCodes) {
      const parsed = parsePermissionCode(code);

      // 修复：无效权限码必须抛出错误，不能静默跳过
      // 静默跳过可能导致安全漏洞，因为检查的权限数量会比预期少
      if (!parsed) {
        throw new Error(`Invalid permission code: ${code}`);
      }

      const result = await mtpc.checkPermission({
        tenant,
        subject,
        resource: parsed.resource,
        action: parsed.action,
      });

      if (!result.allowed) {
        throw new PermissionDeniedError(code, { reason: result.reason });
      }
    }

    await next();
  });
}

/**
 * 资源级权限检查中间件
 * 检查对特定资源实例的访问权限
 *
 * **与 requirePermission 的区别**：
 * - requirePermission：检查资源类型级权限（如 "能否读取用户"）
 * - requireResourcePermission：检查资源实例级权限（如 "能否读取 ID=123 的用户"）
 *
 * **资源 ID 来源**：从路径参数 `:id` 中提取
 *
 * @param resource - 资源名称
 * @param action - 操作类型
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * // 路由格式: /users/:id
 * // 检查用户是否有权限访问 ID=123 的用户
 * app.get('/users/:id', requireResourcePermission('user', 'read'), getUser);
 *
 * app.put('/users/:id', requireResourcePermission('user', 'update'), updateUser);
 * app.delete('/users/:id', requireResourcePermission('user', 'delete'), deleteUser);
 * ```
 */
export function requireResourcePermission(
  resource: string,
  action: string
): MiddlewareHandler<MTPCEnv> {
  return createMiddleware<MTPCEnv>(async (c, next) => {
    const mtpc = c.get('mtpc') as MTPC;

    if (!mtpc) {
      throw new Error('MTPC not initialized. Use mtpcMiddleware first.');
    }

    const tenant = getTenant(c);
    const subject = getSubject(c);

    // 从路径参数中提取资源 ID
    // 路由必须包含 :id 参数，如 /users/:id
    const resourceId = c.req.param('id');

    const result = await mtpc.checkPermission({
      tenant,
      subject,
      resource,
      action,
      resourceId, // 传入资源 ID，进行实例级权限检查
    });

    if (!result.allowed) {
      throw new PermissionDeniedError(createPermissionCode(resource, action), {
        reason: result.reason,
        resourceId, // 在错误信息中包含资源 ID
      });
    }

    await next();
  });
}

/**
 * 动态权限检查中间件
 * 根据请求上下文动态决定检查哪些权限
 *
 * **使用场景**：
 * - 权限参数来自请求体或查询参数
 * - 需要根据请求内容决定权限检查方式
 * - 复杂的多层权限检查逻辑
 *
 * @param resolver - 权限解析函数，从请求中提取权限参数
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * // 根据请求体中的操作类型决定权限
 * app.post('/documents/:id/action', dynamicPermissionCheck(async (c) => {
 *   const body = await c.req.json();
 *   const action = body.action; // 'publish', 'archive', etc.
 *   return {
 *     resource: 'document',
 *     action: action,
 *     resourceId: c.req.param('id')
 *   };
 * }), handleDocumentAction);
 *
 * // 根据查询参数决定权限
 * app.get('/reports/:type', dynamicPermissionCheck(async (c) => {
 *   const reportType = c.req.param('type');
 *   return {
 *     resource: 'report',
 *     action: 'view',
 *     resourceId: reportType
 *   };
 * }), generateReport);
 * ```
 */
export function dynamicPermissionCheck(
  resolver: DynamicPermissionResolver
): MiddlewareHandler<MTPCEnv> {
  return createMiddleware<MTPCEnv>(async (c, next) => {
    const mtpc = c.get('mtpc') as MTPC;

    if (!mtpc) {
      throw new Error('MTPC not initialized. Use mtpcMiddleware first.');
    }

    const tenant = getTenant(c);
    const subject = getSubject(c);

    // 调用解析函数，从请求中提取权限参数
    const { resource, action, resourceId } = await resolver(c);

    const result = await mtpc.checkPermission({
      tenant,
      subject,
      resource,
      action,
      resourceId,
    });

    if (!result.allowed) {
      throw new PermissionDeniedError(createPermissionCode(resource, action), {
        reason: result.reason,
      });
    }

    await next();
  });
}
