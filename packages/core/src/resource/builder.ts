import type {
  AnyZodSchema,
  InferSchema,
  PermissionDefinition,
  ResourceDefinition,
  ResourceDefinitionInput,
  ResourceFeatures,
  ResourceHooks,
  ResourceMetadata,
  ResourceRelationDefinition,
} from '../types/index.js';
import { defineResource } from './define.js';

/**
 * 资源构建器
 * 使用构建器模式创建资源定义，支持链式调用
 * 提供 fluent API 来配置资源的所有属性
 *
 * 特性：
 * - 链式调用构建 API
 * - 支持 CRUD 操作配置
 * - 自动权限生成
 * - 关系定义支持
 * - 钩子系统集成
 * - 元数据配置
 *
 * @example
 * ```typescript
 * const userResource = resource('user', z.object({
 *   id: z.string(),
 *   name: z.string()
 * }))
 *   .displayName('用户')
 *   .description('用户资源')
 *   .enable('create', 'read', 'update', 'delete')
 *   .permission({ action: 'export', description: '导出用户' })
 *   .hasMany('posts', 'post', 'userId')
 *   .build();
 * ```
 */
export class ResourceBuilder<
  TName extends string = string,
  TSchema extends AnyZodSchema = AnyZodSchema,
  TCreateSchema extends AnyZodSchema = TSchema,
  TUpdateSchema extends AnyZodSchema = TSchema,
> {
  /** 资源定义输入对象（内部使用） */
  private input: ResourceDefinitionInput<TName, TSchema, TCreateSchema, TUpdateSchema>;

  /**
   * 创建资源构建器
   *
   * @param name 资源名称
   * @param schema Zod 验证模式
   */
  constructor(name: TName, schema: TSchema) {
    this.input = {
      name,
      schema,
      features: {},
      permissions: [],
      hooks: {},
      relations: [],
      metadata: {},
    } as ResourceDefinitionInput<TName, TSchema, TCreateSchema, TUpdateSchema>;
  }

  /**
   * 设置创建数据的验证模式
   * 用于定义创建资源时的数据结构和验证规则
   *
   * @param schema 创建数据的 Zod 验证模式
   * @returns 新的构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .createSchema(z.object({
   *     name: z.string().min(1),
   *     email: z.string().email()
   *   }))
   *   .build();
   * ```
   */
  createSchema<T extends AnyZodSchema>(
    schema: T
  ): ResourceBuilder<TName, TSchema, T, TUpdateSchema> {
    return new ResourceBuilder<TName, TSchema, T, TUpdateSchema>(
      this.input.name,
      this.input.schema
    ).merge({
      ...this.input,
      createSchema: schema,
    } as ResourceDefinitionInput<TName, TSchema, T, TUpdateSchema>);
  }

  /**
   * 设置更新数据的验证模式
   * 用于定义更新资源时的数据结构和验证规则
   *
   * @param schema 更新数据的 Zod 验证模式
   * @returns 新的构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .updateSchema(z.object({
   *     name: z.string().min(1),
   *     email: z.string().email()
   *   }))
   *   .build();
   * ```
   */
  updateSchema<T extends AnyZodSchema>(
    schema: T
  ): ResourceBuilder<TName, TSchema, TCreateSchema, T> {
    return new ResourceBuilder<TName, TSchema, TCreateSchema, T>(
      this.input.name,
      this.input.schema
    ).merge({
      ...this.input,
      updateSchema: schema,
    } as ResourceDefinitionInput<TName, TSchema, TCreateSchema, T>);
  }

  /**
   * 设置资源特性
   * 配置资源的功能特性，包括基本和高级特性
   *
   * @param features 资源特性配置对象
   * @returns 当前构建器实例，支持链式调用
   * @throws Error 输入参数无效时抛出
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .features({
   *     create: true,
   *     read: true,
   *     update: true,
   *     delete: true,
   *     advanced: {
   *       softDelete: true,
   *       versioning: true
   *     }
   *   })
   *   .build();
   * ```
   */
  features(features: Partial<ResourceFeatures>): this {
    // 输入验证
    if (!features || typeof features !== 'object') {
      throw new Error('features 必须是对象');
    }

    this.input.features = { ...this.input.features, ...features };
    return this;
  }

  /**
   * 启用指定的 CRUD 操作
   * 快速启用资源的操作能力
   *
   * @param operations 要启用的操作列表
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .enable('create', 'read', 'update', 'delete', 'list')
   *   .build();
   * ```
   */
  enable(...operations: Array<'create' | 'read' | 'update' | 'delete' | 'list'>): this {
    for (const op of operations) {
      this.input.features = { ...this.input.features, [op]: true };
    }
    return this;
  }

  /**
   * 禁用指定的 CRUD 操作
   * 快速禁用资源的操作能力
   *
   * @param operations 要禁用的操作列表
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .disable('delete', 'update')
   *   .build();
   * ```
   */
  disable(...operations: Array<'create' | 'read' | 'update' | 'delete' | 'list'>): this {
    for (const op of operations) {
      this.input.features = { ...this.input.features, [op]: false };
    }
    return this;
  }

  /**
   * 设置资源为只读
   * 禁用创建、更新和删除操作，仅允许读取
   *
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .readOnly()
   *   .build();
   * ```
   */
  readOnly(): this {
    return this.disable('create', 'update', 'delete');
  }

  /**
   * 添加权限定义
   * 为资源添加自定义权限
   *
   * @param permission 权限定义对象
   * @returns 当前构建器实例，支持链式调用
   * @throws Error 输入参数无效时抛出
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .permission({
   *     action: 'export',
   *     description: '导出用户数据'
   *   })
   *   .build();
   * ```
   */
  permission(permission: PermissionDefinition): this {
    // 输入验证
    if (!permission || typeof permission !== 'object') {
      throw new Error('permission 必须是对象');
    }

    if (!permission.action || typeof permission.action !== 'string') {
      throw new Error('permission.action 必须是字符串');
    }

    this.input.permissions = [...(this.input.permissions ?? []), permission];
    return this;
  }

  /**
   * 批量添加权限定义
   * 一次性添加多个自定义权限
   *
   * @param permissions 权限定义数组
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .permissions([
   *     { action: 'export', description: '导出' },
   *     { action: 'import', description: '导入' }
   *   ])
   *   .build();
   * ```
   */
  permissions(permissions: PermissionDefinition[]): this {
    this.input.permissions = [...(this.input.permissions ?? []), ...permissions];
    return this;
  }

  /**
   * 添加自定义动作权限
   * 便捷方法，快速添加带描述的权限
   *
   * @param action 动作名称
   * @param description 权限描述
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .action('export', '导出用户数据')
   *   .action('import', '导入用户数据')
   *   .build();
   * ```
   */
  action(action: string, description?: string): this {
    return this.permission({ action, description });
  }

  /**
   * 添加关系定义
   * 定义资源与其他资源的关系
   *
   * @param relation 关系定义对象
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .relation({
   *     name: 'posts',
   *     type: 'hasMany',
   *     target: 'post',
   *     foreignKey: 'userId'
   *   })
   *   .build();
   * ```
   */
  relation(relation: ResourceRelationDefinition): this {
    this.input.relations = [...(this.input.relations ?? []), relation];
    return this;
  }

  /**
   * 添加一对一关系
   * 便捷方法，定义 hasOne 关系
   *
   * @param name 关系名称
   * @param target 目标资源名称
   * @param foreignKey 外键字段名（可选）
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .hasOne('profile', 'profile', 'userId')
   *   .build();
   * ```
   */
  hasOne(name: string, target: string, foreignKey?: string): this {
    return this.relation({ name, type: 'hasOne', target, foreignKey });
  }

  /**
   * 添加一对多关系
   * 便捷方法，定义 hasMany 关系
   *
   * @param name 关系名称
   * @param target 目标资源名称
   * @param foreignKey 外键字段名（可选）
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .hasMany('posts', 'post', 'userId')
   *   .build();
   * ```
   */
  hasMany(name: string, target: string, foreignKey?: string): this {
    return this.relation({ name, type: 'hasMany', target, foreignKey });
  }

  /**
   * 添加多对一关系
   * 便捷方法，定义 belongsTo 关系
   *
   * @param name 关系名称
   * @param target 目标资源名称
   * @param foreignKey 外键字段名（可选）
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('post', postSchema)
   *   .belongsTo('author', 'user', 'userId')
   *   .build();
   * ```
   */
  belongsTo(name: string, target: string, foreignKey?: string): this {
    return this.relation({ name, type: 'belongsTo', target, foreignKey });
  }

  /**
   * 添加多对多关系
   * 便捷方法，定义 belongsToMany 关系
   *
   * @param name 关系名称
   * @param target 目标资源名称
   * @param through 中间表名称
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .belongsToMany('roles', 'role', 'user_roles')
   *   .build();
   * ```
   */
  belongsToMany(name: string, target: string, through: string): this {
    return this.relation({ name, type: 'belongsToMany', target, through });
  }

  /**
   * 设置元数据
   * 配置资源的显示信息和 UI 相关属性
   *
   * @param metadata 元数据对象
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .meta({
   *     displayName: '用户',
   *     description: '用户管理',
   *     group: 'core',
   *     icon: 'users',
   *     hidden: false
   *   })
   *   .build();
   * ```
   */
  meta(metadata: Partial<ResourceMetadata>): this {
    this.input.metadata = { ...this.input.metadata, ...metadata };
    return this;
  }

  /**
   * 设置显示名称
   * 便捷方法，用于设置资源的友好显示名称
   *
   * @param name 显示名称
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .displayName('用户')
   *   .build();
   * ```
   */
  displayName(name: string): this {
    return this.meta({ displayName: name });
  }

  /**
   * 设置描述
   * 便捷方法，用于设置资源的描述信息
   *
   * @param description 描述信息
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .description('用户资源和权限管理')
   *   .build();
   * ```
   */
  description(description: string): this {
    return this.meta({ description });
  }

  /**
   * 设置分组
   * 便捷方法，用于设置资源在 UI 中的分组
   *
   * @param group 分组名称
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .group('core')
   *   .build();
   * ```
   */
  group(group: string): this {
    return this.meta({ group });
  }

  /**
   * 设置图标
   * 便捷方法，用于设置资源在 UI 中的图标
   *
   * @param icon 图标名称或路径
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .icon('users')
   *   .build();
   * ```
   */
  icon(icon: string): this {
    return this.meta({ icon });
  }

  /**
   * 隐藏资源
   * 便捷方法，将资源标记为隐藏，不在 UI 中显示
   *
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .hidden()
   *   .build();
   * ```
   */
  hidden(): this {
    return this.meta({ hidden: true });
  }

  /**
   * 添加标签
   * 为资源添加标签，用于分类和筛选
   *
   * @param tags 标签列表
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .tags('core', 'auth', 'important')
   *   .build();
   * ```
   */
  tags(...tags: string[]): this {
    const existingTags = this.input.metadata?.tags ?? [];
    return this.meta({ tags: [...existingTags, ...tags] });
  }

  /**
   * 添加钩子函数
   * 为资源的 CRUD 操作添加钩子函数
   *
   * @param hooks 钩子函数对象
   * @returns 当前构建器实例，支持链式调用
   *
   * @example
   * ```typescript
   * resource('user', userSchema)
   *   .hooks({
   *     beforeCreate: [validateUser],
   *     afterCreate: [sendWelcomeEmail],
   *     beforeRead: [logAccess]
   *   })
   *   .build();
   * ```
   */
  hooks(hooks: Partial<ResourceHooks<InferSchema<TSchema>>>): this {
    const existing = this.input.hooks ?? {};
    this.input.hooks = {
      beforeCreate: [...(existing.beforeCreate ?? []), ...(hooks.beforeCreate ?? [])],
      afterCreate: [...(existing.afterCreate ?? []), ...(hooks.afterCreate ?? [])],
      beforeRead: [...(existing.beforeRead ?? []), ...(hooks.beforeRead ?? [])],
      afterRead: [...(existing.afterRead ?? []), ...(hooks.afterRead ?? [])],
      beforeUpdate: [...(existing.beforeUpdate ?? []), ...(hooks.beforeUpdate ?? [])],
      afterUpdate: [...(existing.afterUpdate ?? []), ...(hooks.afterUpdate ?? [])],
      beforeDelete: [...(existing.beforeDelete ?? []), ...(hooks.beforeDelete ?? [])],
      afterDelete: [...(existing.afterDelete ?? []), ...(hooks.afterDelete ?? [])],
      beforeList: [...(existing.beforeList ?? []), ...(hooks.beforeList ?? [])],
      afterList: [...(existing.afterList ?? []), ...(hooks.afterList ?? [])],
      filterQuery: [...(existing.filterQuery ?? []), ...(hooks.filterQuery ?? [])],
    };
    return this;
  }

  /**
   * 合并输入对象
   * 内部方法，用于合并构建过程中的输入数据
   *
   * @param input 新的输入对象
   * @returns 当前构建器实例
   */
  private merge(
    input: ResourceDefinitionInput<TName, TSchema, TCreateSchema, TUpdateSchema>
  ): this {
    this.input = input;
    return this;
  }

  /**
   * 构建资源定义
   * 完成资源构建过程，返回最终的资源定义对象
   *
   * @returns 完整的资源定义对象
   *
   * @example
   * ```typescript
   * const userResource = resource('user', userSchema)
   *   .displayName('用户')
   *   .enable('create', 'read', 'update', 'delete')
   *   .build();
   *
   * console.log(userResource.name); // 'user'
   * console.log(userResource.features.create); // true
   * ```
   */
  build(): ResourceDefinition<TName, TSchema, TCreateSchema, TUpdateSchema> {
    return defineResource(this.input);
  }
}

/**
 * 创建资源构建器
 * 工厂函数，用于快速创建资源构建器实例
 * 是构建资源的入口点
 *
 * @param name 资源名称，必须以字母开头，只能包含字母、数字和下划线
 * @param schema Zod 验证模式，定义资源的结构和验证规则
 * @returns 资源构建器实例，支持链式调用
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { resource } from '@mtpc/core/resource';
 *
 * // 创建简单的用户资源
 * const userResource = resource('user', z.object({
 *   id: z.string(),
 *   name: z.string(),
 *   email: z.string().email(),
 *   createdAt: z.date()
 * }))
 *   .displayName('用户')
 *   .description('用户资源和权限管理')
 *   .enable('create', 'read', 'update', 'delete', 'list')
 *   .action('export', '导出用户数据')
 *   .hasMany('posts', 'post', 'userId')
 *   .build();
 *
 * // 使用特性配置
 * const productResource = resource('product', z.object({
 *   id: z.string(),
 *   name: z.string(),
 *   price: z.number()
 * }))
 *   .displayName('产品')
 *   .enable('create', 'read', 'update', 'list')
 *   .features({
 *     advanced: {
 *       softDelete: true,
 *       versioning: true,
 *       auditLog: true
 *     }
 *   })
 *   .build();
 * ```
 */
export function resource<TName extends string, TSchema extends AnyZodSchema>(
  name: TName,
  schema: TSchema
): ResourceBuilder<TName, TSchema, TSchema, TSchema> {
  return new ResourceBuilder(name, schema);
}
