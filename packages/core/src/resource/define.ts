import { z } from 'zod';
import { generatePermissions } from '../permission/generate.js';
import type { AnyZodSchema, ResourceDefinition, ResourceDefinitionInput } from '../types/index.js';
import { createEmptyHooks, createResourceFeatures } from '../types/index.js';

/**
 * 定义资源
 * 根据输入的配置创建完整的资源定义对象
 * 自动生成创建/更新验证模式、权限、特性等
 *
 * 特性：
 * - 自动生成权限（基于特性配置）
 * - 智能创建和更新模式处理
 * - 自动生成显示名称和复数形式
 * - 合并自定义权限和特性
 * - 完整的元数据支持
 *
 * @param input 资源定义输入对象
 * @returns 完整的资源定义对象
 *
 * @example
 * ```typescript
 * const userResource = defineResource({
 *   name: 'user',
 *   schema: z.object({
 *     id: z.string(),
 *     name: z.string()
 *   }),
 *   features: {
 *     create: true,
 *     read: true,
 *     update: true,
 *     delete: true
 *   },
 *   metadata: {
 *     displayName: '用户',
 *     group: 'core'
 *   }
 * });
 * ```
 */
export function defineResource<
  const TName extends string,
  const TSchema extends AnyZodSchema,
  const TCreateSchema extends AnyZodSchema = TSchema,
  const TUpdateSchema extends AnyZodSchema = TSchema,
>(
  input: ResourceDefinitionInput<TName, TSchema, TCreateSchema, TUpdateSchema>
): ResourceDefinition<TName, TSchema, TCreateSchema, TUpdateSchema> {
  // 输入验证
  if (!input || typeof input !== 'object') {
    throw new Error('input 必须是对象');
  }

  if (!input.name || typeof input.name !== 'string') {
    throw new Error('input.name 必须是字符串');
  }

  if (!input.schema || typeof input.schema !== 'object') {
    throw new Error('input.schema 必须是对象');
  }

  const features = createResourceFeatures(input.features);

  // 如果未提供创建模式，使用主模式
  const createSchema = (input.createSchema ?? input.schema) as TCreateSchema;

  // 如果未提供更新模式，自动生成部分模式
  const updateSchema = (() => {
    if (input.updateSchema) {
      return input.updateSchema;
    }

    // 仅对 ZodObject 类型生成部分模式
    if (input.schema instanceof z.ZodObject) {
      return input.schema.partial();
    }

    // 对于非对象模式，使用原始模式
    return input.schema;
  })() as TUpdateSchema;

  // 基于特性生成默认权限
  const basePermissions = generatePermissions(input.name, features);
  const customPermissions = input.permissions ?? [];

  // 合并权限，自定义权限优先
  const permissionMap = new Map(basePermissions.map(p => [p.action, p]));
  for (const p of customPermissions) {
    permissionMap.set(p.action, p);
  }

  return {
    name: input.name,
    schema: input.schema,
    createSchema,
    updateSchema,
    features,
    permissions: Array.from(permissionMap.values()),
    hooks: {
      ...createEmptyHooks(),
      ...input.hooks,
    },
    relations: input.relations ?? [],
    metadata: {
      displayName: input.metadata?.displayName ?? formatDisplayName(input.name),
      pluralName: input.metadata?.pluralName ?? pluralizeDisplayName(input.name),
      description: input.metadata?.description,
      icon: input.metadata?.icon,
      group: input.metadata?.group,
      sortOrder: input.metadata?.sortOrder ?? 0,
      hidden: input.metadata?.hidden ?? false,
      tags: input.metadata?.tags ?? [],
    },
  };
}

/**
 * 格式化资源名称为显示名称
 * 将驼峰命名转换为友好的显示名称
 *
 * @param name 资源名称
 * @returns 格式化后的显示名称
 *
 * @example
 * ```typescript
 * formatDisplayName('userProfile'); // 'User Profile'
 * formatDisplayName('user_management'); // 'User Management'
 * formatDisplayName('User'); // 'User'
 * ```
 */
function formatDisplayName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^./, s => s.toUpperCase());
}

/**
 * 复数化显示名称
 * 简单的英文复数化实现
 *
 * @param name 资源名称
 * @returns 复数形式的显示名称
 *
 * @example
 * ```typescript
 * pluralizeDisplayName('User'); // 'Users'
 * pluralizeDisplayName('Category'); // 'Categories'
 * pluralizeDisplayName('Post'); // 'Posts'
 * pluralizeDisplayName('Box'); // 'Boxes'
 * ```
 */
function pluralizeDisplayName(name: string): string {
  const displayName = formatDisplayName(name);
  if (displayName.endsWith('y')) {
    return displayName.slice(0, -1) + 'ies';
  }
  if (
    displayName.endsWith('s') ||
    displayName.endsWith('x') ||
    displayName.endsWith('ch') ||
    displayName.endsWith('sh')
  ) {
    return displayName + 'es';
  }
  return displayName + 's';
}
