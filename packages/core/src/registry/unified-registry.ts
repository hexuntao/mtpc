import type {
  CompiledPolicy,
  Permission,
  PolicyDefinition,
  ResourceDefinition,
} from '../types/index.js';
import { PermissionRegistry } from './permission-registry.js';
import { PolicyRegistry } from './policy-registry.js';
import { ResourceRegistry } from './resource-registry.js';

/**
 * 统一注册表
 * 统一管理所有 MTPC 注册表（资源、权限、策略）
 * 提供一站式的注册、查询和管理接口，简化使用
 *
 * 特性：
 * - 统一管理三个子注册表
 * - 资源注册时自动注册其权限
 * - 提供元数据导出功能
 * - 支持全局注册表实例
 * - 冻结所有子注册表
 *
 * @example
 * ```typescript
 * const registry = createUnifiedRegistry();
 *
 * // 注册资源（会自动注册权限）
 * registry.registerResource({
 *   name: 'user',
 *   displayName: '用户',
 *   permissions: [{ action: 'read', description: '读取用户' }],
 *   metadata: { group: 'core' }
 * });
 *
 * // 注册策略
 * registry.registerPolicy({
 *   id: 'admin-policy',
 *   name: '管理员策略',
 *   rules: [{ permissions: ['*'], effect: 'allow' }]
 * });
 *
 * // 获取统计信息
 * const summary = registry.getSummary();
 * console.log(summary); // { resources: 1, permissions: 1, policies: 1 }
 * ```
 */
export class UnifiedRegistry {
  /** 资源注册表（只读） */
  readonly resources: ResourceRegistry;

  /** 权限注册表（只读） */
  readonly permissions: PermissionRegistry;

  /** 策略注册表（只读） */
  readonly policies: PolicyRegistry;

  /**
   * 创建统一注册表实例
   * 内部创建三个子注册表
   */
  constructor() {
    this.resources = new ResourceRegistry();
    this.permissions = new PermissionRegistry();
    this.policies = new PolicyRegistry();
  }

  /**
   * 注册资源及其权限
   * 同时将资源注册到资源注册表，并将其权限注册到权限注册表
   *
   * @param resource 资源定义对象
   *
   * @example
   * ```typescript
   * registry.registerResource({
   *   name: 'user',
   *   displayName: '用户',
   *   permissions: [
   *     { action: 'read', description: '读取用户' },
   *     { action: 'write', description: '写入用户' }
   *   ],
   *   metadata: { group: 'core' }
   * });
   * ```
   */
  registerResource(resource: ResourceDefinition): void {
    this.resources.register(resource);
    this.permissions.registerMany(resource.name, resource.permissions);
  }

  /**
   * 批量注册资源
   * 一次性注册多个资源和其权限
   *
   * @param resources 资源定义数组
   *
   * @example
   * ```typescript
   * registry.registerResources([
   *   { name: 'user', permissions: [...] },
   *   { name: 'role', permissions: [...] }
   * ]);
   * ```
   */
  registerResources(resources: ResourceDefinition[]): void {
    for (const resource of resources) {
      this.registerResource(resource);
    }
  }

  /**
   * 注册策略
   *
   * @param policy 策略定义对象
   * @returns 编译后的策略对象
   *
   * @example
   * ```typescript
   * const compiled = registry.registerPolicy({
   *   id: 'admin-policy',
   *   name: '管理员策略',
   *   rules: [{ permissions: ['*'], effect: 'allow' }]
   * });
   * ```
   */
  registerPolicy(policy: PolicyDefinition): CompiledPolicy {
    return this.policies.register(policy);
  }

  /**
   * 批量注册策略
   *
   * @param policies 策略定义数组
   * @returns 编译后策略对象数组
   *
   * @example
   * ```typescript
   * registry.registerPolicies([
   *   { id: 'policy-1', rules: [...] },
   *   { id: 'policy-2', rules: [...] }
   * ]);
   * ```
   */
  registerPolicies(policies: PolicyDefinition[]): CompiledPolicy[] {
    return this.policies.registerMany(policies);
  }

  /**
   * 获取所有权限代码
   *
   * @returns 权限代码字符串数组
   *
   * @example
   * ```typescript
   * const codes = registry.getAllPermissionCodes();
   * console.log(codes); // ['user:read', 'user:write', ...]
   * ```
   */
  getAllPermissionCodes(): string[] {
    return this.permissions.codes();
  }

  /**
   * 获取权限代码对象
   *
   * @returns 权限代码对象
   *
   * @example
   * ```typescript
   * const codes = registry.getPermissionCodesObject();
   * console.log(codes);
   * // { USER_READ: 'user:read', USER_WRITE: 'user:write', ... }
   * ```
   */
  getPermissionCodesObject(): Record<string, string> {
    return this.permissions.toCodesObject();
  }

  /**
   * 获取资源及其权限
   * 同时获取资源定义和其所有权限
   *
   * @param name 资源名称
   * @returns 资源和权限对象，如果资源不存在则返回 undefined
   *
   * @example
   * ```typescript
   * const result = registry.getResourceWithPermissions('user');
   * if (result) {
   *   console.log(result.resource.displayName);
   *   console.log(result.permissions);
   * }
   * ```
   */
  getResourceWithPermissions(name: string):
    | {
        resource: ResourceDefinition;
        permissions: Permission[];
      }
    | undefined {
    const resource = this.resources.get(name);

    if (!resource) {
      return undefined;
    }

    return {
      resource,
      permissions: this.permissions.getByResource(name),
    };
  }

  /**
   * 冻结所有注册表
   * 同时冻结资源和权限注册表（策略注册表不支持冻结）
   *
   * @example
   * ```typescript
   * registry.freeze();
   * console.log(registry.isFrozen()); // true
   * ```
   */
  freeze(): void {
    this.resources.freeze();
    this.permissions.freeze();
    // 注意：PolicyRegistry 不支持冻结
  }

  /**
   * 检查所有注册表是否已冻结
   * 只有当资源和权限注册表都已冻结时才返回 true
   *
   * @returns 冻结状态
   */
  isFrozen(): boolean {
    return this.resources.isFrozen() && this.permissions.isFrozen();
  }

  /**
   * 获取统计信息
   * 统计各注册表中的项目数量
   *
   * @returns 包含资源、权限、策略数量的统计对象
   *
   * @example
   * ```typescript
   * const summary = registry.getSummary();
   * console.log(`资源: ${summary.resources}, 权限: ${summary.permissions}, 策略: ${summary.policies}`);
   * ```
   */
  getSummary(): {
    resources: number;
    permissions: number;
    policies: number;
  } {
    return {
      resources: this.resources.size,
      permissions: this.permissions.size,
      policies: this.policies.size,
    };
  }

  /**
   * 清空所有注册表（主要用于测试）
   *
   * @example
   * ```typescript
   * // 测试后清理
   * registry.clear();
   * ```
   */
  clear(): void {
    this.resources.clear();
    this.permissions.clear();
    this.policies.clear();
  }

  /**
   * 导出元数据
   * 导出适合 UI 消费的资源元数据格式
   *
   * @returns 包含资源元数据的对象
   *
   * @example
   * ```typescript
   * const metadata = registry.exportMetadata();
   * console.log(metadata.resources);
   * // [
   * //   {
   * //     name: 'user',
   * //     displayName: '用户',
   * //     permissions: ['user:read', 'user:write'],
   * //     features: { ... },
   * //     metadata: { ... }
   * //   }
   * // ]
   * ```
   */
  exportMetadata(): {
    resources: Array<{
      name: string;
      displayName: string;
      permissions: string[];
      features: ResourceDefinition['features'];
      metadata: ResourceDefinition['metadata'];
    }>;
  } {
    return {
      resources: this.resources.list().map(r => ({
        name: r.name,
        displayName: r.metadata.displayName ?? r.name,
        permissions: this.permissions.getCodesByResource(r.name),
        features: r.features,
        metadata: r.metadata,
      })),
    };
  }
}

/**
 * 创建统一注册表
 * 工厂函数，用于创建统一注册表实例
 *
 * @returns 统一注册表实例
 *
 * @example
 * ```typescript
 * const registry = createUnifiedRegistry();
 * registry.registerResource({
 *   name: 'user',
 *   permissions: [...]
 * });
 * ```
 */
export function createUnifiedRegistry(): UnifiedRegistry {
  return new UnifiedRegistry();
}

/** 全局注册表实例（单例） */
let globalRegistry: UnifiedRegistry | null = null;

/**
 * 获取或创建全局注册表
 * 使用单例模式，确保整个应用中只有一个统一注册表实例
 *
 * @returns 全局统一注册表实例
 *
 * @example
 * ```typescript
 * const registry = getGlobalRegistry();
 * registry.registerResource({ ... });
 * ```
 */
export function getGlobalRegistry(): UnifiedRegistry {
  if (!globalRegistry) {
    globalRegistry = createUnifiedRegistry();
  }
  return globalRegistry;
}

/**
 * 重置全局注册表（主要用于测试）
 * 将全局注册表实例置为 null，下次调用 getGlobalRegistry() 时会创建新实例
 *
 * @example
 * ```typescript
 * // 测试后重置
 * resetGlobalRegistry();
 * ```
 */
export function resetGlobalRegistry(): void {
  globalRegistry = null;
}
