import { ResourceAlreadyExistsError, ResourceNotFoundError } from '@mtpc/shared';
import { validateResourceDefinition } from '../resource/validator.js';
import type { ResourceDefinition } from '../types/index.js';

/**
 * 资源注册表
 * 负责资源的注册、存储、查询和管理
 * 提供按组分类和可见性过滤功能，支持冻结机制防止运行时修改
 *
 * 特性：
 * - 资源注册和验证
 * - 按组分类
 * - 可见性过滤（隐藏资源）
 * - 冻结机制防止运行时修改
 * - 迭代器支持
 *
 * @example
 * ```typescript
 * const registry = createResourceRegistry();
 *
 * // 注册资源
 * registry.register({
 *   name: 'user',
 *   displayName: '用户',
 *   permissions: [...],
 *   metadata: { group: 'core' }
 * });
 *
 * // 查询资源
 * const resource = registry.get('user');
 * const userGroupResources = registry.getByGroup('core');
 * const visibleResources = registry.getVisible();
 * ```
 */
export class ResourceRegistry {
  /** 资源映射：资源名 -> 资源定义 */
  private resources: Map<string, ResourceDefinition> = new Map();

  /** 注册表冻结状态，防止运行时修改 */
  private frozen = false;

  /**
   * 注册资源
   * 将资源定义验证后注册到注册表中
   * 不允许重复注册相同名称的资源
   *
   * @param resource 资源定义对象
   * @throws Error 注册表已冻结、资源已存在或参数无效时抛出错误
   *
   * @example
   * ```typescript
   * registry.register({
   *   name: 'user',
   *   displayName: '用户',
   *   permissions: [...],
   *   metadata: { group: 'core', displayName: '用户管理' }
   * });
   * ```
   */
  register(resource: ResourceDefinition): void {
    // 输入验证
    if (!resource || typeof resource !== 'object') {
      throw new Error('resource 必须是对象');
    }

    if (!resource.name || typeof resource.name !== 'string') {
      throw new Error('resource.name 必须是字符串');
    }

    if (!resource.permissions || !Array.isArray(resource.permissions)) {
      throw new Error('resource.permissions 必须是数组');
    }

    if (!resource.metadata || typeof resource.metadata !== 'object') {
      throw new Error('resource.metadata 必须是对象');
    }

    if (this.frozen) {
      throw new Error('Registry is frozen. Cannot register new resources.');
    }

    if (this.resources.has(resource.name)) {
      throw new ResourceAlreadyExistsError(resource.name);
    }

    validateResourceDefinition(resource);
    this.resources.set(resource.name, resource);
  }

  /**
   * 批量注册资源
   * 一次性注册多个资源定义
   *
   * @param resources 资源定义数组
   * @throws Error 输入参数无效时抛出
   *
   * @example
   * ```typescript
   * registry.registerMany([
   *   { name: 'user', permissions: [...] },
   *   { name: 'role', permissions: [...] }
   * ]);
   * ```
   */
  registerMany(resources: ResourceDefinition[]): void {
    // 输入验证
    if (!resources || !Array.isArray(resources)) {
      throw new Error('resources 必须是数组');
    }

    if (resources.length === 0) {
      throw new Error('resources 不能为空数组');
    }

    // 事务性注册：失败时回滚
    const registered: string[] = [];
    try {
      for (const resource of resources) {
        this.register(resource);
        registered.push(resource.name);
      }
    } catch (error) {
      // 回滚已注册的资源
      for (const name of registered) {
        this.resources.delete(name);
      }
      throw error;
    }
  }

  /**
   * 根据资源名称获取资源
   *
   * @param name 资源名称
   * @returns 资源定义对象，如果不存在则返回 undefined
   *
   * @example
   * ```typescript
   * const resource = registry.get('user');
   * if (resource) {
   *   console.log(resource.displayName);
   * }
   * ```
   */
  get(name: string): ResourceDefinition | undefined {
    return this.resources.get(name);
  }

  /**
   * 根据资源名称获取资源，不存在则抛出异常
   *
   * @param name 资源名称
   * @returns 资源定义对象
   * @throws ResourceNotFoundError 资源不存在时抛出
   *
   * @example
   * ```typescript
   * try {
   *   const resource = registry.getOrThrow('user');
   *   console.log(resource.displayName);
   * } catch (error) {
   *   console.error('资源不存在:', error.message);
   * }
   * ```
   */
  getOrThrow(name: string): ResourceDefinition {
    const resource = this.resources.get(name);

    if (!resource) {
      throw new ResourceNotFoundError(name);
    }

    return resource;
  }

  /**
   * 检查资源是否存在
   *
   * @param name 资源名称
   * @returns 存在返回 true，否则返回 false
   *
   * @example
   * ```typescript
   * if (registry.has('user')) {
   *   console.log('资源已注册');
   * }
   * ```
   */
  has(name: string): boolean {
    return this.resources.has(name);
  }

  /**
   * 获取所有资源
   *
   * @returns 资源定义对象数组
   *
   * @example
   * ```typescript
   * const allResources = registry.list();
   * console.log(`共注册 ${allResources.length} 个资源`);
   * ```
   */
  list(): ResourceDefinition[] {
    return Array.from(this.resources.values());
  }

  /**
   * 获取所有资源名称
   *
   * @returns 资源名称字符串数组
   *
   * @example
   * ```typescript
   * const names = registry.names();
   * console.log('资源名称:', names);
   * ```
   */
  names(): string[] {
    return Array.from(this.resources.keys());
  }

  /**
   * 根据分组获取资源列表
   *
   * @param group 分组名称
   * @returns 属于该分组的资源对象数组
   *
   * @example
   * ```typescript
   * const coreResources = registry.getByGroup('core');
   * coreResources.forEach(r => console.log(r.name));
   * ```
   */
  getByGroup(group: string): ResourceDefinition[] {
    return this.list().filter(r => r.metadata.group === group);
  }

  /**
   * 获取可见资源列表
   * 过滤掉标记为隐藏的资源（metadata.hidden = true）
   *
   * @returns 可见资源对象数组
   *
   * @example
   * ```typescript
   * const visible = registry.getVisible();
   * console.log('可见资源数量:', visible.length);
   * ```
   */
  getVisible(): ResourceDefinition[] {
    return this.list().filter(r => !r.metadata.hidden);
  }

  /**
   * 冻结注册表
   * 冻结后无法再注册新资源或清空注册表
   * 通常在应用初始化完成后调用
   *
   * @example
   * ```typescript
   * // 完成所有资源注册后冻结
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
   * 获取注册表中的资源总数
   *
   * @returns 资源数量
   *
   * @example
   * ```typescript
   * console.log(`当前共有 ${registry.size} 个资源`);
   * ```
   */
  get size(): number {
    return this.resources.size;
  }

  /**
   * 清空所有资源（主要用于测试）
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
      throw new Error('Registry is frozen. Cannot clear resources.');
    }
    this.resources.clear();
  }

  /**
   * 迭代器
   * 支持 for...of 循环遍历资源
   *
   * @example
   * ```typescript
   * for (const [name, resource] of registry) {
   *   console.log(name, resource.displayName);
   * }
   * ```
   */
  [Symbol.iterator](): Iterator<[string, ResourceDefinition]> {
    return this.resources[Symbol.iterator]();
  }

  /**
   * 遍历所有资源
   * 为每个资源执行回调函数
   *
   * @param callback 回调函数，接收资源对象和资源名
   *
   * @example
   * ```typescript
   * registry.forEach((resource, name) => {
   *   console.log(name, resource.displayName);
   * });
   * ```
   */
  forEach(callback: (resource: ResourceDefinition, name: string) => void): void {
    this.resources.forEach((resource, name) => callback(resource, name));
  }
}

/**
 * 创建资源注册表
 * 工厂函数，用于创建资源注册表实例
 *
 * @returns 资源注册表实例
 *
 * @example
 * ```typescript
 * const registry = createResourceRegistry();
 * registry.register({
 *   name: 'user',
 *   permissions: [...]
 * });
 * ```
 */
export function createResourceRegistry(): ResourceRegistry {
  return new ResourceRegistry();
}
