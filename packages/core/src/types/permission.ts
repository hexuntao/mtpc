import type { SubjectContext } from './context.js';
import type { TenantContext } from './tenant.js';

/**
 * 默认 CRUD 操作类型
 * 标准化的资源操作枚举
 *
 * @example
 * ```typescript
 * // 检查是否支持某操作
 * const supports = (action: CRUDAction, features: ResourceFeatures) => {
 *   return features[action] === true;
 * };
 *
 * // 权限代码生成
 * const permissionCode = `user:${action}`; // user:create, user:read, etc.
 * ```
 */
export type CRUDAction = 'create' | 'read' | 'update' | 'delete' | 'list';

/**
 * 权限动作类型
 * 可以是标准 CRUD 操作或自定义动作
 *
 * @example
 * ```typescript
 * // 标准 CRUD 动作
 * type StandardAction = CRUDAction; // 'create' | 'read' | 'update' | 'delete' | 'list'
 *
 * // 自定义动作
 * type CustomAction = 'export' | 'import' | 'approve' | 'publish';
 *
 * // 混合使用
 * const userPermissions: PermissionDefinition[] = [
 *   { action: 'create' },    // 标准动作
 *   { action: 'export' },    // 自定义动作
 *   { action: 'approve' }    // 自定义动作
 * ];
 * ```
 */
export type PermissionAction = CRUDAction | string;

/**
 * 权限作用域
 * 定义权限的有效范围
 *
 * @example
 * ```typescript
 * // 全局权限 - 所有租户可用
 * const globalPermission: PermissionDefinition = {
 *   action: 'system:backup',
 *   scope: 'global'
 * };
 *
 * // 租户权限 - 仅当前租户内可用
 * const tenantPermission: PermissionDefinition = {
 *   action: 'user:create',
 *   scope: 'tenant'
 * };
 *
 * // 自主权限 - 仅可操作自己的资源
 * const ownPermission: PermissionDefinition = {
 *   action: 'profile:update',
 *   scope: 'own'  // 只能更新自己的资料
 * };
 * ```
 */
export type PermissionScope = 'global' | 'tenant' | 'own';

/**
 * 权限定义
 * 定义一个权限的基本信息和特性
 *
 * @example
 * ```typescript
 * // 基础权限定义
 * const createUserPermission: PermissionDefinition = {
 *   action: 'create',
 *   description: '创建用户',
 *   scope: 'tenant'
 * };
 *
 * // 带条件的权限定义
 * const adminPermission: PermissionDefinition = {
 *   action: 'user:*',
 *   description: '用户管理权限',
 *   scope: 'tenant',
 *   conditions: [
 *     { field: 'subject.roles', operator: 'contains', value: 'admin' }
 *   ]
 * };
 *
 * // 带元数据的权限定义
 * const vipPermission: PermissionDefinition = {
 *   action: 'premium:access',
 *   description: 'VIP 功能访问权限',
 *   scope: 'tenant',
 *   metadata: {
 *     tier: 'vip',
 *     price: 99
 *   }
 * };
 * ```
 */
export interface PermissionDefinition {
  /** 权限动作 */
  action: PermissionAction;
  /** 权限描述（可选） */
  description?: string;
  /** 权限作用域（可选，默认为 tenant） */
  scope?: PermissionScope;
  /** 权限条件（可选） */
  conditions?: PermissionCondition[];
  /** 额外元数据（可选） */
  metadata?: Record<string, unknown>;
}

/**
 * 权限条件
 * 用于定义权限生效的附加条件
 *
 * @example
 * ```typescript
 * // 时间条件
 * const timeCondition: PermissionCondition = {
 *   field: 'request.timestamp',
 *   operator: 'between',
 *   value: { start: '09:00', end: '18:00' }
 * };
 *
 * // IP 条件
 * const ipCondition: PermissionCondition = {
 *   field: 'request.ip',
 *   operator: 'in',
 *   value: ['192.168.1.0/24', '10.0.0.0/8']
 * };
 *
 * // 角色条件
 * const roleCondition: PermissionCondition = {
 *   field: 'subject.roles',
 *   operator: 'contains',
 *   value: 'admin'
 * };
 *
 * // 组合条件
 * const complexCondition: PermissionCondition = {
 *   field: 'resource.ownerId',
 *   operator: 'eq',
 *   value: 'subject.id'  // 只能操作自己的资源
 * };
 * ```
 */
export interface PermissionCondition {
  /** 要检查的字段路径 */
  field: string;
  /** 条件操作符 */
  operator: PermissionConditionOperator;
  /** 期望值 */
  value: unknown;
}

/**
 * 权限条件操作符
 * 用于构建权限条件表达式
 *
 * @example
 * ```typescript
 * // 相等性检查
 * { field: 'status', operator: 'eq', value: 'active' }
 * { field: 'status', operator: 'neq', value: 'deleted' }
 *
 * // 数值比较
 * { field: 'age', operator: 'gt', value: 18 }
 * { field: 'score', operator: 'gte', value: 60 }
 * { field: 'priority', operator: 'lt', value: 5 }
 * { field: 'count', operator: 'lte', value: 100 }
 *
 * // 集合包含
 * { field: 'roles', operator: 'in', value: ['admin', 'manager'] }
 * { field: 'tags', operator: 'notIn', value: ['banned', 'suspended'] }
 *
 * // 字符串包含
 * { field: 'description', operator: 'contains', value: 'important' }
 * { field: 'email', operator: 'startsWith', value: 'admin@' }
 * { field: 'filename', operator: 'endsWith', value: '.pdf' }
 *
 * // 正则匹配
 * { field: 'username', operator: 'matches', value: '^[a-zA-Z0-9_]+$' }
 * ```
 */
export type PermissionConditionOperator =
  | 'eq' // 等于
  | 'neq' // 不等于
  | 'gt' // 大于
  | 'gte' // 大于等于
  | 'lt' // 小于
  | 'lte' // 小于等于
  | 'in' // 在集合中
  | 'notIn' // 不在集合中
  | 'contains' // 包含（字符串或数组）
  | 'matches'; // 正则匹配

/**
 * 编译后的权限
 * 包含权限的所有信息，用于权限检查
 *
 * @example
 * ```typescript
 * const permission: Permission = {
 *   code: 'user:create',
 *   resource: 'user',
 *   action: 'create',
 *   scope: 'tenant',
 *   description: '创建用户',
 *   conditions: [],
 *   metadata: { createdAt: new Date() }
 * };
 * ```
 */
export interface Permission {
  /** 权限代码（格式: resource:action） */
  readonly code: string;
  /** 所属资源 */
  readonly resource: string;
  /** 权限动作 */
  readonly action: PermissionAction;
  /** 权限作用域 */
  readonly scope: PermissionScope;
  /** 权限描述（可选） */
  readonly description?: string;
  /** 权限条件列表 */
  readonly conditions: PermissionCondition[];
  /** 额外元数据 */
  readonly metadata: Record<string, unknown>;
}

/**
 * 权限代码类型
 * 使用模板字面量确保格式正确
 *
 * @example
 * ```typescript
 * // 基础权限代码
 * type UserPermission = PermissionCode<'user', 'create'>;
 * // 等价于: 'user:create'
 *
 * // 自定义动作
 * type OrderPermission = PermissionCode<'order', 'approve'>;
 * // 等价于: 'order:approve'
 *
 * // 通配符权限
 * type WildcardPermission = PermissionCode<'user', '*'>;
 * // 等价于: 'user:*'
 *
 * // 通用权限代码
 * type AnyPermission = PermissionCode<string, string>;
 * // 等价于: `${string}:${string}`
 * ```
 */
export type PermissionCode<
  TResource extends string = string,
  TAction extends string = string,
> = `${TResource}:${TAction}`;

/**
 * 权限检查上下文
 * 包含权限检查所需的所有信息
 *
 * @example
 * ```typescript
 * // 基础检查上下文
 * const context: PermissionCheckContext = {
 *   tenant: { id: 'tenant-1' },
 *   subject: { id: 'user-123', type: 'user' },
 *   resource: 'user',
 *   action: 'create'
 * };
 *
 * // 资源级权限检查
 * const resourceContext: PermissionCheckContext = {
 *   tenant: { id: 'tenant-1' },
 *   subject: { id: 'user-123', type: 'user' },
 *   resource: 'order',
 *   action: 'read',
 *   resourceId: 'order-456',  // 检查特定订单
 *   data: { status: 'pending' }  // 额外数据
 * };
 *
 * // 服务间调用
 * const serviceContext: PermissionCheckContext = {
 *   tenant: { id: 'tenant-1' },
 *   subject: { id: 'order-service', type: 'service' },
 *   resource: 'user',
 *   action: 'read'
 * };
 * ```
 */
export interface PermissionCheckContext {
  /** 租户上下文 */
  tenant: TenantContext;
  /** 主体上下文 */
  subject: SubjectContext;
  /** 资源名称 */
  resource: string;
  /** 权限动作 */
  action: string;
  /** 资源 ID（可选，用于资源级权限） */
  resourceId?: string;
  /** 额外数据（可选） */
  data?: Record<string, unknown>;
}

/**
 * 权限检查结果
 * 返回权限检查的详细结果
 *
 * @example
 * ```typescript
 * // 允许访问
 * const allowedResult: PermissionCheckResult = {
 *   allowed: true,
 *   permission: 'user:create',
 *   reason: 'Direct permission on subject',
 *   evaluationTime: 2.5
 * };
 *
 * // 拒绝访问
 * const deniedResult: PermissionCheckResult = {
 *   allowed: false,
 *   permission: 'user:delete',
 *   reason: 'Permission not granted',
 *   matchedPolicies: ['default-deny-policy'],
 *   evaluationTime: 1.8
 * };
 *
 * // 带策略匹配的结果
 * const policyResult: PermissionCheckResult = {
 *   allowed: true,
 *   permission: 'user:update',
 *   reason: 'Policy matched: working-hours-policy',
 *   matchedPolicies: ['working-hours-policy', 'admin-override-policy'],
 *   evaluationTime: 5.2
 * };
 * ```
 */
export interface PermissionCheckResult {
  /** 是否允许访问 */
  allowed: boolean;
  /** 检查的权限代码 */
  permission: string;
  /** 允许/拒绝的原因（可选） */
  reason?: string;
  /** 匹配的策略列表（可选） */
  matchedPolicies?: string[];
  /** 评估耗时（毫秒，可选） */
  evaluationTime?: number;
}

/**
 * 批量权限检查结果
 * 用于一次性检查多个权限
 *
 * @example
 * ```typescript
 * const batchResult: BatchPermissionCheckResult = {
 *   results: new Map([
 *     ['user:create', { allowed: true, permission: 'user:create', reason: '...' }],
 *     ['user:read', { allowed: true, permission: 'user:read', reason: '...' }],
 *     ['user:delete', { allowed: false, permission: 'user:delete', reason: '...' }]
 *   ]),
 *   allAllowed: false,  // 并非所有权限都允许
 *   anyAllowed: true     // 至少有一个权限允许
 * };
 *
 * // 检查所有权限
 * if (batchResult.allAllowed) {
 *   // 用户有所有权限，执行操作
 * }
 *
 * // 检查是否有任意权限
 * if (batchResult.anyAllowed) {
 *   // 用户至少有一个权限，显示部分功能
 * }
 * ```
 */
export interface BatchPermissionCheckResult {
  /** 权限检查结果映射 */
  results: Map<string, PermissionCheckResult>;
  /** 是否所有权限都允许 */
  allAllowed: boolean;
  /** 是否有任意权限允许 */
  anyAllowed: boolean;
}

/**
 * 权限评估器函数类型
 * 用于自定义权限评估逻辑
 *
 * @example
 * ```typescript
 * // 数据库权限评估器
 * const databaseEvaluator: PermissionEvaluator = async (context) => {
 *   const permissions = await db.query(`
 *     SELECT permission_code
 *     FROM user_permissions
 *     WHERE user_id = ? AND tenant_id = ?
 *   `, [context.subject.id, context.tenant.id]);
 *
 *   const permissionCode = `${context.resource}:${context.action}`;
 *   const hasPermission = permissions.includes(permissionCode);
 *
 *   return {
 *     allowed: hasPermission,
 *     permission: permissionCode,
 *     reason: hasPermission ? 'Database lookup' : 'Not found in database'
 *   };
 * };
 *
 * // RBAC 权限评估器
 * const rbacEvaluator: PermissionEvaluator = async (context) => {
 *   const roles = await getUserRoles(context.subject.id, context.tenant.id);
 *   const rolePermissions = await getRolePermissions(roles);
 *
 *   const permissionCode = `${context.resource}:${context.action}`;
 *   const hasPermission = rolePermissions.includes(permissionCode) ||
 *                        rolePermissions.includes('*') ||
 *                        rolePermissions.includes(`${context.resource}:*`);
 *
 *   return {
 *     allowed: hasPermission,
 *     permission: permissionCode,
 *     reason: hasPermission ? 'RBAC check passed' : 'No matching role permission'
 *   };
 * };
 *
 * // 缓存权限评估器
 * const cachedEvaluator = createCachedEvaluator(databaseEvaluator, {
 *   ttl: 300000  // 5分钟缓存
 * });
 * ```
 *
 * @param context 权限检查上下文
 * @returns 权限检查结果
 */
export type PermissionEvaluator = (
  context: PermissionCheckContext
) => Promise<PermissionCheckResult>;

/**
 * 权限集合
 * 用于权限缓存和批量操作
 *
 * @example
 * ```typescript
 * // 缓存权限集合
 * const permissionSet: PermissionSet = {
 *   permissions: new Set([
 *     'user:create',
 *     'user:read',
 *     'user:update',
 *     'order:*'
 *   ]),
 *   tenantId: 'tenant-1',
 *   subjectId: 'user-123',
 *   expiresAt: new Date(Date.now() + 3600000)  // 1小时后过期
 * };
 *
 * // 使用权限集合
 * const hasPermission = (set: PermissionSet, permission: string): boolean => {
 *   // 检查过期时间
 *   if (set.expiresAt && set.expiresAt < new Date()) {
 *     return false;  // 已过期
 *   }
 *
 *   // 检查具体权限
 *   if (set.permissions.has(permission)) {
 *     return true;
 *   }
 *
 *   // 检查通配符权限
 *   const [resource] = permission.split(':');
 *   if (set.permissions.has(`${resource}:*`)) {
 *     return true;
 *   }
 *
 *   // 检查全局通配符
 *   if (set.permissions.has('*')) {
 *     return true;
 *   }
 *
 *   return false;
 * };
 * ```
 */
export interface PermissionSet {
  /** 权限集合 */
  permissions: Set<string>;
  /** 租户 ID */
  tenantId: string;
  /** 主体 ID */
  subjectId: string;
  /** 过期时间（可选） */
  expiresAt?: Date;
}
