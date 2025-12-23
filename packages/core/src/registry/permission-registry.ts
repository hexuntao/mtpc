import { PermissionNotFoundError } from '@mtpc/shared';
import { compilePermission } from '../permission/generate.js';
import type { Permission, PermissionDefinition } from '../types/index.js';

/**
 * 权限注册表
 * 负责权限的注册、存储、查询和管理
 * 提供按资源分类的权限索引，支持冻结机制防止运行时修改
 *
 * 特性：
 * - 权限注册和编译
 * - 按资源分类索引
 * - 冻结机制防止运行时修改
 * - 批量操作支持
 * - 权限代码导出
 *
 * @example
 * ```typescript
 * const registry = createPermissionRegistry();
 *
 * // 注册权限
 * registry.register('user', { action: 'read', description: '读取用户' });
 * registry.register('user', { action: 'write', description: '写入用户' });
 *
 * // 查询权限
 * const permission = registry.get('user:read');
 * const userPermissions = registry.getByResource('user');
 *
 * // 冻结注册表
 * registry.freeze();
 * ```
 */
export class PermissionRegistry {
  /** 权限映射：权限代码 -> 权限对象 */
  private permissions: Map<string, Permission> = new Map();

  /** 按资源分类的权限索引：资源名 -> 权限代码集合 */
  private byResource: Map<string, Set<string>> = new Map();

  /** 注册表冻结状态，防止运行时修改 */
  private frozen = false;

  /**
   * 注册权限
   * 将权限定义编译并注册到注册表中
   * 支持更新已存在的权限
   *
   * @param resourceName 资源名称
   * @param definition 权限定义对象
   * @returns 编译后的权限对象
   * @throws Error 注册表已冻结时抛出错误
   *
   * @example
   * ```typescript
   * // 注册新权限
   * registry.register('user', { action: 'read', description: '读取用户' });
   *
   * // 更新已存在的权限
   * registry.register('user', { action: 'read', description: '读取用户（已更新）' });
   * ```
   */
  register(resourceName: string, definition: PermissionDefinition): Permission {
    // 输入验证
    if (!resourceName || typeof resourceName !== 'string') {
      throw new Error('resourceName 必须是字符串');
    }

    if (!definition || typeof definition !== 'object') {
      throw new Error('definition 必须是对象');
    }

    if (!definition.action || typeof definition.action !== 'string') {
      throw new Error('definition.action 必须是字符串');
    }

    if (this.frozen) {
      throw new Error('Registry is frozen. Cannot register new permissions.');
    }

    const permission = compilePermission(resourceName, definition);
    const isUpdate = this.permissions.has(permission.code);

    // 设置权限（无论新增还是更新）
    this.permissions.set(permission.code, permission);

    // 仅在新增时更新资源索引
    if (!isUpdate) {
      let resourcePerms = this.byResource.get(resourceName);
      if (!resourcePerms) {
        resourcePerms = new Set();
        this.byResource.set(resourceName, resourcePerms);
      }
      resourcePerms.add(permission.code);
    }

    return permission;
  }

  /**
   * 批量注册权限
   * 一次性注册多个权限定义到指定资源
   *
   * @param resourceName 资源名称
   * @param definitions 权限定义数组
   * @returns 编译后权限对象数组
   * @throws Error 输入参数无效时抛出
   *
   * @example
   * ```typescript
   * registry.registerMany('user', [
   *   { action: 'read', description: '读取用户' },
   *   { action: 'write', description: '写入用户' },
   *   { action: 'delete', description: '删除用户' }
   * ]);
   * ```
   */
  registerMany(resourceName: string, definitions: PermissionDefinition[]): Permission[] {
    // 输入验证
    if (!resourceName || typeof resourceName !== 'string') {
      throw new Error('resourceName 必须是字符串');
    }

    if (!definitions || !Array.isArray(definitions)) {
      throw new Error('definitions 必须是数组');
    }

    if (definitions.length === 0) {
      throw new Error('definitions 不能为空数组');
    }

    return definitions.map(def => this.register(resourceName, def));
  }

  /**
   * 根据权限代码获取权限
   *
   * @param code 权限代码（如 'user:read'）
   * @returns 权限对象，如果不存在则返回 undefined
   *
   * @example
   * ```typescript
   * const permission = registry.get('user:read');
   * if (permission) {
   *   console.log(permission.description); // '读取用户'
   * }
   * ```
   */
  get(code: string): Permission | undefined {
    return this.permissions.get(code);
  }

  /**
   * 根据权限代码获取权限，不存在则抛出异常
   *
   * @param code 权限代码
   * @returns 权限对象
   * @throws PermissionNotFoundError 权限不存在时抛出
   *
   * @example
   * ```typescript
   * try {
   *   const permission = registry.getOrThrow('user:read');
   *   console.log(permission.description);
   * } catch (error) {
   *   console.error('权限不存在:', error.message);
   * }
   * ```
   */
  getOrThrow(code: string): Permission {
    const permission = this.permissions.get(code);

    if (!permission) {
      throw new PermissionNotFoundError(code);
    }

    return permission;
  }

  /**
   * 检查权限是否存在
   *
   * @param code 权限代码
   * @returns 存在返回 true，否则返回 false
   *
   * @example
   * ```typescript
   * if (registry.has('user:read')) {
   *   console.log('权限已注册');
   * }
   * ```
   */
  has(code: string): boolean {
    return this.permissions.has(code);
  }

  /**
   * 获取所有权限
   *
   * @returns 权限对象数组
   *
   * @example
   * ```typescript
   * const allPermissions = registry.list();
   * console.log(`共注册 ${allPermissions.length} 个权限`);
   * ```
   */
  list(): Permission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * 获取所有权限代码
   *
   * @returns 权限代码字符串数组
   *
   * @example
   * ```typescript
   * const codes = registry.codes();
   * console.log(codes); // ['user:read', 'user:write', ...]
   * ```
   */
  codes(): string[] {
    return Array.from(this.permissions.keys());
  }

  /**
   * 根据资源获取权限列表
   *
   * @param resourceName 资源名称
   * @returns 权限对象数组
   *
   * @example
   * ```typescript
   * const userPermissions = registry.getByResource('user');
   * userPermissions.forEach(p => console.log(p.code, p.description));
   * ```
   */
  getByResource(resourceName: string): Permission[] {
    const codes = this.byResource.get(resourceName);

    if (!codes) {
      return [];
    }

    return Array.from(codes)
      .map(code => this.permissions.get(code)!)
      .filter(Boolean);
  }

  /**
   * 根据资源获取权限代码列表
   *
   * @param resourceName 资源名称
   * @returns 权限代码字符串数组
   *
   * @example
   * ```typescript
   * const codes = registry.getCodesByResource('user');
   * console.log(codes); // ['user:read', 'user:write', ...]
   * ```
   */
  getCodesByResource(resourceName: string): string[] {
    const codes = this.byResource.get(resourceName);
    return codes ? Array.from(codes) : [];
  }

  /**
   * 获取所有已注册的资源名称
   *
   * @returns 资源名称字符串数组
   *
   * @example
   * ```typescript
   * const resources = registry.getResources();
   * console.log('已注册的资源:', resources);
   * ```
   */
  getResources(): string[] {
    return Array.from(this.byResource.keys());
  }

  /**
   * 冻结注册表
   * 冻结后无法再注册新权限或清空注册表
   * 通常在应用初始化完成后调用
   *
   * @example
   * ```typescript
   * // 完成所有权限注册后冻结
   * registry.freeze();
   * console.log(registry.isFrozen()); // true
   * ```
   */
  freeze(): void {
    this.frozen = true;
  }

  /**
   * 检查注册表是否已冻结
   *
   * @returns 冻结状态
   */
  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * 获取注册表中的权限总数
   *
   * @returns 权限数量
   *
   * @example
   * ```typescript
   * console.log(`当前共有 ${registry.size} 个权限`);
   * ```
   */
  get size(): number {
    return this.permissions.size;
  }

  /**
   * 清空所有权限（主要用于测试）
   *
   * @throws Error 注册表已冻结时抛出错误
   *
   * @example
   * ```typescript
   * // 测试后清理
   * registry.clear();
   * ```
   */
  clear(): void {
    if (this.frozen) {
      throw new Error('Registry is frozen. Cannot clear permissions.');
    }
    this.permissions.clear();
    this.byResource.clear();
  }

  /**
   * 导出为权限代码对象
   * 将权限转换为键值对形式，键格式为 RESOURCE_ACTION
   *
   * @returns 权限代码对象
   *
   * @example
   * ```typescript
   * const codes = registry.toCodesObject();
   * console.log(codes);
   * // { USER_READ: 'user:read', USER_WRITE: 'user:write', ... }
   * ```
   */
  toCodesObject(): Record<string, string> {
    const result: Record<string, string> = {};

    const permissions = Array.from(this.permissions.values());
    for (const permission of permissions) {
      const key = `${permission.resource.toUpperCase()}_${permission.action.toUpperCase()}`;
      result[key] = permission.code;
    }

    return result;
  }
}

/**
 * 创建权限注册表
 * 工厂函数，用于创建权限注册表实例
 *
 * @returns 权限注册表实例
 *
 * @example
 * ```typescript
 * const registry = createPermissionRegistry();
 * registry.register('user', { action: 'read', description: '读取用户' });
 * ```
 */
export function createPermissionRegistry(): PermissionRegistry {
  return new PermissionRegistry();
}
