import type { ResourceDefinition, ResourceFeatures } from '../types/index.js';

/**
 * 检查资源是否启用了指定特性
 * 支持检查基本特性和高级特性
 *
 * @param resource 资源定义对象
 * @param feature 要检查的特性名称
 * @returns 如果启用了该特性返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * const userResource = resource('user', userSchema).enable('create', 'read').build();
 *
 * hasFeature(userResource, 'create'); // true
 * hasFeature(userResource, 'delete'); // false
 * hasFeature(userResource, 'advanced.softDelete'); // false
 * ```
 */
export function hasFeature(
  resource: ResourceDefinition,
  feature: keyof ResourceFeatures | keyof ResourceFeatures['advanced']
): boolean {
  if (feature in resource.features) {
    return resource.features[feature as keyof ResourceFeatures] as boolean;
  }

  if (feature in resource.features.advanced) {
    return resource.features.advanced[feature as keyof ResourceFeatures['advanced']];
  }

  return false;
}

/**
 * 获取资源的所有权限代码
 * 格式为 "资源名:动作名"
 *
 * @param resource 资源定义对象
 * @returns 权限代码字符串数组
 *
 * @example
 * ```typescript
 * const userResource = resource('user', userSchema).enable('create', 'read').build();
 * const codes = getResourcePermissionCodes(userResource);
 * // ['user:create', 'user:read']
 * ```
 */
export function getResourcePermissionCodes(resource: ResourceDefinition): string[] {
  return resource.permissions.map(p => `${resource.name}:${p.action}`);
}

/**
 * 获取资源的所有动作
 *
 * @param resource 资源定义对象
 * @returns 动作名称字符串数组
 *
 * @example
 * ```typescript
 * const userResource = resource('user', userSchema).enable('create', 'read').build();
 * const actions = getResourceActions(userResource);
 * // ['create', 'read']
 * ```
 */
export function getResourceActions(resource: ResourceDefinition): string[] {
  return resource.permissions.map(p => p.action);
}

/**
 * 检查资源是否支持指定动作
 *
 * @param resource 资源定义对象
 * @param action 动作名称
 * @returns 如果支持该动作返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * const userResource = resource('user', userSchema).enable('create', 'read').build();
 *
 * supportsAction(userResource, 'create'); // true
 * supportsAction(userResource, 'delete'); // false
 * ```
 */
export function supportsAction(resource: ResourceDefinition, action: string): boolean {
  return resource.permissions.some(p => p.action === action);
}

/**
 * 从资源的 Zod 模式中获取字段名列表
 * 仅支持 ZodObject 类型
 *
 * @param resource 资源定义对象
 * @returns 字段名字符串数组，如果不是对象模式则返回空数组
 *
 * @example
 * ```typescript
 * const userResource = resource('user', z.object({
 *   id: z.string(),
 *   name: z.string(),
 *   email: z.string()
 * })).build();
 *
 * const fields = getResourceFields(userResource);
 * // ['id', 'name', 'email']
 * ```
 */
export function getResourceFields(resource: ResourceDefinition): string[] {
  const schema = resource.schema;

  if (schema._def.typeName === 'ZodObject') {
    return Object.keys((schema as any).shape);
  }

  return [];
}

/**
 * 扩展资源定义
 * 将基础资源与扩展配置合并，创建新的资源定义
 * 用于继承和复用资源定义
 *
 * @param base 基础资源定义
 * @param extension 扩展配置（部分资源定义属性）
 * @returns 合并后的资源定义对象
 *
 * @example
 * ```typescript
 * const baseUser = resource('user', userSchema)
 *   .enable('create', 'read')
 *   .build();
 *
 * const adminUser = extendResource(baseUser, {
 *   features: {
 *     delete: true,
 *     advanced: {
 *       auditLog: true
 *     }
 *   },
 *   permissions: [
 *     { action: 'manage', description: '管理用户' }
 *   ]
 * });
 * ```
 */
export function extendResource<T extends ResourceDefinition>(
  base: T,
  extension: Partial<Omit<T, 'name' | 'schema'>>
): T {
  return {
    ...base,
    features: {
      ...base.features,
      ...extension.features,
      advanced: {
        ...base.features.advanced,
        ...extension.features?.advanced,
      },
    },
    permissions: [...base.permissions, ...(extension.permissions ?? [])],
    hooks: mergeHooks(base.hooks, extension.hooks ?? {}),
    relations: [...base.relations, ...(extension.relations ?? [])],
    metadata: {
      ...base.metadata,
      ...extension.metadata,
      tags: [...(base.metadata.tags ?? []), ...(extension.metadata?.tags ?? [])],
    },
  } as T;
}

/**
 * 合并钩子函数
 * 将基础钩子与扩展钩子合并，扩展钩子追加到基础钩子之后
 *
 * @param base 基础钩子对象
 * @param extension 扩展钩子对象
 * @returns 合并后的钩子对象
 *
 * @example
 * ```typescript
 * const baseHooks = { beforeCreate: [validateUser] };
 * const extensionHooks = { beforeCreate: [logAccess], afterCreate: [sendEmail] };
 * const merged = mergeHooks(baseHooks, extensionHooks);
 * // { beforeCreate: [validateUser, logAccess], afterCreate: [sendEmail] }
 * ```
 */
function mergeHooks(
  base: ResourceDefinition['hooks'],
  extension: Partial<ResourceDefinition['hooks']>
): ResourceDefinition['hooks'] {
  return {
    beforeCreate: [...(base.beforeCreate ?? []), ...(extension.beforeCreate ?? [])],
    afterCreate: [...(base.afterCreate ?? []), ...(extension.afterCreate ?? [])],
    beforeRead: [...(base.beforeRead ?? []), ...(extension.beforeRead ?? [])],
    afterRead: [...(base.afterRead ?? []), ...(extension.afterRead ?? [])],
    beforeUpdate: [...(base.beforeUpdate ?? []), ...(extension.beforeUpdate ?? [])],
    afterUpdate: [...(base.afterUpdate ?? []), ...(extension.afterUpdate ?? [])],
    beforeDelete: [...(base.beforeDelete ?? []), ...(extension.beforeDelete ?? [])],
    afterDelete: [...(base.afterDelete ?? []), ...(extension.afterDelete ?? [])],
    beforeList: [...(base.beforeList ?? []), ...(extension.beforeList ?? [])],
    afterList: [...(base.afterList ?? []), ...(extension.afterList ?? [])],
    filterQuery: [...(base.filterQuery ?? []), ...(extension.filterQuery ?? [])],
  };
}
