import type { AnyZodSchema, InferSchema } from './common.js';
import type { ResourceFeatures } from './features.js';
import type { ResourceHooks } from './hooks.js';
import type { PermissionDefinition } from './permission.js';

/**
 * 资源字段定义
 * 描述资源中单个字段的元数据信息
 *
 * @example
 * ```typescript
 * const userNameField: ResourceFieldDefinition = {
 *   name: 'name',
 *   type: 'string',
 *   required: true,
 *   unique: true,
 *   indexed: true,
 *   description: '用户姓名'
 * };
 *
 * const emailField: ResourceFieldDefinition = {
 *   name: 'email',
 *   type: 'string',
 *   required: true,
 *   unique: true,
 *   indexed: true,
 *   defaultValue: null,
 *   description: '用户邮箱地址'
 * };
 * ```
 */
export interface ResourceFieldDefinition {
  /** 字段名称 */
  name: string;
  /** 字段类型（如：string, number, boolean, date 等） */
  type: string;
  /** 是否必需 */
  required: boolean;
  /** 是否唯一（可选） */
  unique?: boolean;
  /** 是否已索引（可选，用于提高查询性能） */
  indexed?: boolean;
  /** 默认值（可选） */
  defaultValue?: unknown;
  /** 字段描述（可选） */
  description?: string;
}

/**
 * 资源关系类型
 * 定义资源之间可能存在的关联关系类型
 *
 * @example
 * ```typescript
 * // 用户与用户配置：一对一关系
 * type UserProfileRelation = 'hasOne';
 *
 * // 用户与订单：一对多关系
 * type UserOrdersRelation = 'hasMany';
 *
 * // 订单与用户：多对一关系
 * type OrderUserRelation = 'belongsTo';
 *
 * // 用户与角色：多对多关系
 * type UserRolesRelation = 'belongsToMany';
 * ```
 */
export type ResourceRelationType =
  | 'hasOne' // 一对一：一个资源实例关联另一个资源实例
  | 'hasMany' // 一对多：一个资源实例关联多个另一个资源实例
  | 'belongsTo' // 多对一：多个资源实例关联同一个另一个资源实例
  | 'belongsToMany'; // 多对多：多个资源实例关联多个另一个资源实例

/**
 * 资源关系定义
 * 描述两个资源之间的关联关系
 *
 * @example
 * ```typescript
 * // 用户拥有多个订单（一对多）
 * const userOrdersRelation: ResourceRelationDefinition = {
 *   name: 'orders',
 *   type: 'hasMany',
 *   target: 'order',
 *   foreignKey: 'userId',
 *   description: '用户的所有订单'
 * };
 *
 * // 订单属于用户（多对一）
 * const orderUserRelation: ResourceRelationDefinition = {
 *   name: 'user',
 *   type: 'belongsTo',
 *   target: 'user',
 *   foreignKey: 'userId',
 *   description: '订单所属用户'
 * };
 *
 * // 用户拥有多个角色（多对多）
 * const userRolesRelation: ResourceRelationDefinition = {
 *   name: 'roles',
 *   type: 'belongsToMany',
 *   target: 'role',
 *   through: 'user_roles',  // 中间表
 *   foreignKey: 'userId',
 *   description: '用户拥有的所有角色'
 * };
 * ```
 */
export interface ResourceRelationDefinition {
  /** 关系名称 */
  name: string;
  /** 关系类型 */
  type: ResourceRelationType;
  /** 目标资源名称 */
  target: string;
  /** 外键字段名（可选，hasMany/belongsTo 时使用） */
  foreignKey?: string;
  /** 中间表名（可选，belongsToMany 时使用） */
  through?: string;
  /** 关系描述（可选） */
  description?: string;
}

/**
 * 资源元数据
 * 包含资源的展示和管理相关的信息
 *
 * @example
 * ```typescript
 * const userMetadata: ResourceMetadata = {
 *   displayName: '用户',
 *   pluralName: '用户列表',
 *   description: '系统用户信息管理',
 *   icon: 'user-group-icon',
 *   group: 'user-management',
 *   sortOrder: 1,
 *   hidden: false,
 *   tags: ['core', 'auth']
 * };
 *
 * const orderMetadata: ResourceMetadata = {
 *   displayName: '订单',
 *   pluralName: '订单管理',
 *   description: '订单生命周期管理',
 *   icon: 'shopping-cart',
 *   group: 'business',
 *   sortOrder: 2,
 *   tags: ['commerce', 'finance']
 * };
 * ```
 */
export interface ResourceMetadata {
  /** 资源显示名称（单数形式，可选） */
  displayName?: string;
  /** 资源复数名称（可选） */
  pluralName?: string;
  /** 资源描述（可选） */
  description?: string;
  /** 资源图标标识符（可选） */
  icon?: string;
  /** 资源所属分组（可选，用于 UI 分类） */
  group?: string;
  /** 资源排序顺序（可选，用于 UI 展示排序） */
  sortOrder?: number;
  /** 是否隐藏（可选，隐藏的资源不在 UI 中显示） */
  hidden?: boolean;
  /** 资源标签列表（可选，用于分类和筛选） */
  tags?: string[];
  /** 数据范围控制配置（可选） */
  dataScope?: ResourceDataScopeConfig;
}

/**
 * 资源数据范围控制配置
 * 声明式配置资源的数据范围控制行为
 *
 * @example
 * ```typescript
 * // 用户资源：默认按租户隔离
 * const userDataScope: ResourceDataScopeConfig = {
 *   enabled: true,
 *   defaultScope: 'tenant'
 * };
 *
 * // 订单资源：默认按部门隔离，但管理员可查看全部
 * const orderDataScope: ResourceDataScopeConfig = {
 *   enabled: true,
 *   defaultScope: 'department',
 *   adminBypass: true
 * };
 *
 * // 日志资源：不启用数据范围控制
 * const logDataScope: ResourceDataScopeConfig = {
 *   enabled: false
 * };
 *
 * // 敏感数据：仅个人可访问
 * const profileDataScope: ResourceDataScopeConfig = {
 *   enabled: true,
 *   defaultScope: 'self',
 *   ownerField: 'userId'
 * };
 * ```
 */
export interface ResourceDataScopeConfig {
  /** 是否启用数据范围控制（默认 true） */
  enabled?: boolean;
  /** 默认范围类型（如：'tenant'、'department'、'self'） */
  defaultScope?: 'all' | 'tenant' | 'department' | 'team' | 'self' | 'subordinates' | 'custom';
  /** 所有者字段名（默认 'createdBy'，用于 self 类型范围） */
  ownerField?: string;
  /** 部门字段名（默认 'departmentId'，用于 department 类型范围） */
  departmentField?: string;
  /** 团队字段名（默认 'teamId'，用于 team 类型范围） */
  teamField?: string;
  /** 管理员是否可绕过限制（默认 false） */
  adminBypass?: boolean;
  /** 自定义范围 ID（当 defaultScope 为 'custom' 时使用） */
  customScopeId?: string;
}

/**
 * 资源定义输入参数
 * 用于创建资源定义的结构化输入
 *
 * @example
 * ```typescript
 * // 简单的用户资源定义
 * const userResource: ResourceDefinitionInput = {
 *   name: 'user',
 *   schema: z.object({
 *     id: z.string(),
 *     name: z.string(),
 *     email: z.string().email()
 *   }),
 *   features: {
 *     create: true,
 *     read: true,
 *     update: true,
 *     delete: true,
 *     list: true
 *   },
 *   permissions: [
 *     { action: 'create', description: '创建用户', scope: 'tenant' },
 *     { action: 'read', description: '查看用户', scope: 'tenant' }
 *   ],
 *   metadata: {
 *     displayName: '用户',
 *     pluralName: '用户列表'
 *   }
 * };
 *
 * // 带自定义创建/更新模式的资源
 * const orderResource: ResourceDefinitionInput = {
 *   name: 'order',
 *   schema: z.object({
 *     id: z.string(),
 *     userId: z.string(),
 *     total: z.number(),
 *     status: z.enum(['pending', 'completed', 'cancelled'])
 *   }),
 *   createSchema: z.object({
 *     userId: z.string(),
 *     items: z.array(z.object({ productId: z.string(), quantity: z.number() }))
 *   }),
 *   updateSchema: z.object({
 *     status: z.enum(['pending', 'completed', 'cancelled'])
 *   }),
 *   features: { create: true, update: true },
 *   relations: [
 *     { name: 'user', type: 'belongsTo', target: 'user', foreignKey: 'userId' }
 *   ]
 * };
 * ```
 */
export interface ResourceDefinitionInput<
  /** 资源名称类型 */
  TName extends string = string,
  /** 完整资源模式类型 */
  TSchema extends AnyZodSchema = AnyZodSchema,
  /** 创建时模式类型 */
  TCreateSchema extends AnyZodSchema = AnyZodSchema,
  /** 更新时模式类型 */
  TUpdateSchema extends AnyZodSchema = AnyZodSchema,
> {
  /** 资源名称（唯一标识符） */
  name: TName;
  /** 完整的 Zod 模式定义（必需） */
  schema: TSchema;
  /** 创建时的 Zod 模式（可选，默认为 schema） */
  createSchema?: TCreateSchema;
  /** 更新时的 Zod 模式（可选，默认为 schema.partial()） */
  updateSchema?: TUpdateSchema;
  /** 资源特性配置（可选） */
  features?: Partial<ResourceFeatures>;
  /** 资源权限定义列表（可选） */
  permissions?: PermissionDefinition[];
  /** 资源钩子定义（可选） */
  hooks?: Partial<ResourceHooks<InferSchema<TSchema>>>;
  /** 资源关系定义列表（可选） */
  relations?: ResourceRelationDefinition[];
  /** 资源元数据（可选） */
  metadata?: ResourceMetadata;
}

/**
 * 资源定义（编译后）
 * 完整的资源定义结构，包含所有必需字段（只读）
 * 这是通过 defineResource() 函数生成的最终格式
 *
 * @example
 * ```typescript
 * const userDefinition: ResourceDefinition = {
 *   readonly name: 'user',
 *   readonly schema: z.object({...}),
 *   readonly createSchema: z.object({...}),
 *   readonly updateSchema: z.object({...}),
 *   readonly features: { create: true, read: true, ... },
 *   readonly permissions: [...],
 *   readonly hooks: { beforeCreate: [...], afterCreate: [...] },
 *   readonly relations: [...],
 *   readonly metadata: { displayName: '用户', ... }
 * };
 * ```
 */
export interface ResourceDefinition<
  /** 资源名称类型 */
  TName extends string = string,
  /** 完整资源模式类型 */
  TSchema extends AnyZodSchema = AnyZodSchema,
  /** 创建时模式类型 */
  TCreateSchema extends AnyZodSchema = AnyZodSchema,
  /** 更新时模式类型 */
  TUpdateSchema extends AnyZodSchema = AnyZodSchema,
> {
  /** 资源名称（只读） */
  readonly name: TName;
  /** 完整的 Zod 模式（只读） */
  readonly schema: TSchema;
  /** 创建时的 Zod 模式（只读） */
  readonly createSchema: TCreateSchema;
  /** 更新时的 Zod 模式（只读） */
  readonly updateSchema: TUpdateSchema;
  /** 资源特性配置（只读） */
  readonly features: ResourceFeatures;
  /** 权限定义列表（只读） */
  readonly permissions: PermissionDefinition[];
  /** 资源钩子定义（只读） */
  readonly hooks: ResourceHooks<InferSchema<TSchema>>;
  /** 资源关系定义列表（只读） */
  readonly relations: ResourceRelationDefinition[];
  /** 资源元数据（只读） */
  readonly metadata: ResourceMetadata;
}

/**
 * 资源实体类型提取工具
 * 从资源定义中提取实体（数据结构）的 TypeScript 类型
 *
 * @example
 * ```typescript
 * const userResource = defineResource({
 *   name: 'user',
 *   schema: z.object({
 *     id: z.string(),
 *     name: z.string(),
 *     email: z.string()
 *   })
 * });
 *
 * type User = ResourceEntity<typeof userResource>;
 * // 等价于：
 * // type User = {
 * //   id: string;
 * //   name: string;
 * //   email: string;
 * // }
 * ```
 *
 * @param T 资源定义类型
 * @returns 资源实体类型
 */
export type ResourceEntity<T extends ResourceDefinition> =
  T extends ResourceDefinition<string, infer S, AnyZodSchema, AnyZodSchema>
    ? InferSchema<S>
    : never;

/**
 * 资源创建输入类型提取工具
 * 从资源定义中提取创建操作所需的输入数据结构
 *
 * @example
 * ```typescript
 * const orderResource = defineResource({
 *   name: 'order',
 *   schema: z.object({
 *     id: z.string(),
 *     userId: z.string(),
 *     total: z.number(),
 *     status: z.string()
 *   }),
 *   createSchema: z.object({
 *     userId: z.string(),
 *     items: z.array(z.object({ productId: z.string(), quantity: z.number() }))
 *   })
 * });
 *
 * type CreateOrderInput = ResourceCreateInput<typeof orderResource>;
 * // 等价于：
 * // type CreateOrderInput = {
 * //   userId: string;
 * //   items: { productId: string; quantity: number; }[];
 * // }
 * ```
 *
 * @param T 资源定义类型
 * @returns 创建输入类型
 */
export type ResourceCreateInput<T extends ResourceDefinition> =
  T extends ResourceDefinition<string, AnyZodSchema, infer C, AnyZodSchema>
    ? InferSchema<C>
    : never;

/**
 * 资源更新输入类型提取工具
 * 从资源定义中提取更新操作所需的输入数据结构
 *
 * @example
 * ```typescript
 * const userResource = defineResource({
 *   name: 'user',
 *   schema: z.object({
 *     id: z.string(),
 *     name: z.string(),
 *     email: z.string(),
 *     password: z.string(),
 *     createdAt: z.date()
 *   }),
 *   updateSchema: z.object({
 *     name: z.string().optional(),
 *     email: z.string().optional()
 *   })
 * });
 *
 * type UpdateUserInput = ResourceUpdateInput<typeof userResource>;
 * // 等价于：
 * // type UpdateUserInput = {
 * //   name?: string;
 * //   email?: string;
 * // }
 * ```
 *
 * @param T 资源定义类型
 * @returns 更新输入类型
 */
export type ResourceUpdateInput<T extends ResourceDefinition> =
  T extends ResourceDefinition<string, AnyZodSchema, AnyZodSchema, infer U>
    ? InferSchema<U>
    : never;

/**
 * 资源映射表
 * 存储所有已注册资源的映射表结构
 *
 * @example
 * ```typescript
 * const resourceMap: ResourceMap = new Map([
 *   ['user', userResource],
 *   ['order', orderResource],
 *   ['product', productResource]
 * ]);
 *
 * // 遍历所有资源
 * for (const [name, definition] of resourceMap) {
 *   console.log(`资源名称: ${name}`);
 *   console.log(`资源特性: ${definition.features}`);
 * }
 * ```
 */
export type ResourceMap = Map<string, ResourceDefinition>;

/**
 * 资源名称提取工具
 * 从资源映射表中提取所有资源名称的联合类型
 *
 * @example
 * ```typescript
 * const resourceMap: ResourceMap = new Map([
 *   ['user', userResource],
 *   ['order', orderResource],
 *   ['product', productResource]
 * ]);
 *
 * type ResourceNameList = ResourceNames<typeof resourceMap>;
 * // 等价于：
 * // type ResourceNameList = 'user' | 'order' | 'product'
 * ```
 *
 * @param T 资源映射表类型
 * @returns 资源名称联合类型
 */
export type ResourceNames<T extends ResourceMap> =
  T extends Map<infer K, ResourceDefinition> ? K : never;
