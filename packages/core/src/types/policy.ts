import type { RequestContext, SubjectContext } from './context.js';
import type { Permission } from './permission.js';
import type { TenantContext } from './tenant.js';

/**
 * 策略效果类型
 * 定义策略评估的结果
 *
 * @example
 * ```typescript
 * // 允许策略
 * const allowPolicy: PolicyDefinition = {
 *   id: 'allow-admin-access',
 *   rules: [{
 *     permissions: ['*'],
 *     effect: 'allow'
 *   }]
 * };
 *
 * // 拒绝策略
 * const denyPolicy: PolicyDefinition = {
 *   id: 'deny-deleted-users',
 *   rules: [{
 *     permissions: ['*'],
 *     effect: 'deny',
 *     conditions: [{
 *       field: 'resource.status',
 *       operator: 'eq',
 *       value: 'deleted'
 *     }]
 *   }]
 * };
 *
 * // 混合策略
 * const mixedPolicy: PolicyDefinition = {
 *   id: 'working-hours-policy',
 *   rules: [
 *     {
 *       permissions: ['*'],
 *       effect: 'allow',
 *       conditions: [{
 *         field: 'request.timestamp',
 *         operator: 'between',
 *         value: { start: '09:00', end: '18:00' }
 *       }]
 *     },
 *     {
 *       permissions: ['*'],
 *       effect: 'deny',
 *       conditions: [{
 *         field: 'request.timestamp',
 *         operator: 'between',
 *         value: { start: '00:00', end: '06:00' }
 *       }]
 *     }
 *   ]
 * };
 * ```
 */
export type PolicyEffect = 'allow' | 'deny';

/**
 * 策略优先级
 * 定义策略的执行优先级
 *
 * @example
 * ```typescript
 * // 低优先级 - 最后执行
 * const lowPriority: PolicyDefinition = {
 *   id: 'default-allow',
 *   priority: 'low',
 *   rules: [{
 *     permissions: ['*'],
 *     effect: 'allow'
 *   }]
 * };
 *
 * // 普通优先级 - 默认级别
 * const normalPriority: PolicyDefinition = {
 *   id: 'user-access-policy',
 *   priority: 'normal',
 *   rules: [...]
 * };
 *
 * // 高优先级 - 优先执行
 * const highPriority: PolicyDefinition = {
 *   id: 'security-lockdown',
 *   priority: 'high',
 *   rules: [{
 *     permissions: ['*'],
 *     effect: 'deny',
 *     conditions: [{
 *       field: 'request.ip',
 *       operator: 'in',
 *       value: ['192.168.1.0/24']  // 仅允许内网
 *     }]
 *   }]
 * };
 *
 * // 关键优先级 - 最高优先级
 * const criticalPriority: PolicyDefinition = {
 *   id: 'emergency-shutdown',
 *   priority: 'critical',
 *   rules: [{
 *     permissions: ['*'],
 *     effect: 'deny'
 *   }]
 * };
 * ```
 */
export type PolicyPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * 策略条件类型
 * 定义不同类型的条件检查
 *
 * @example
 * ```typescript
 * // 字段比较条件
 * const fieldCondition: PolicyCondition = {
 *   type: 'field',
 *   field: 'resource.ownerId',
 *   operator: 'eq',
 *   value: 'subject.id'  // 只能操作自己的资源
 * };
 *
 * // 时间条件
 * const timeCondition: PolicyCondition = {
 *   type: 'time',
 *   operator: 'between',
 *   value: {
 *     start: '09:00',
 *     end: '18:00',
 *     timezone: 'Asia/Shanghai'
 *   }
 * };
 *
 * // IP 条件
 * const ipCondition: PolicyCondition = {
 *   type: 'ip',
 *   operator: 'in',
 *   value: ['192.168.1.0/24', '10.0.0.0/8']
 * };
 *
 * // 自定义函数条件
 * const customCondition: PolicyCondition = {
 *   type: 'custom',
 *   fn: async (context) => {
 *     // 自定义逻辑
 *     return context.subject.roles.includes('admin');
 *   }
 * };
 * ```
 */
export type PolicyConditionType =
  | 'field' // 字段比较
  | 'time' // 时间条件
  | 'ip' // IP 条件
  | 'custom'; // 自定义函数

/**
 * 策略条件
 * 定义策略规则的生效条件
 *
 * @example
 * ```typescript
 * // 基础条件
 * const simpleCondition: PolicyCondition = {
 *   type: 'field',
 *   field: 'resource.status',
 *   operator: 'eq',
 *   value: 'active'
 * };
 *
 * // 复合条件
 * const complexCondition: PolicyCondition = {
 *   type: 'custom',
 *   fn: async (context) => {
 *     // 检查多个字段
 *     const isWorkingHours = checkWorkingHours(context.request.timestamp);
 *     const isAdmin = context.subject.roles.includes('admin');
 *     const isInternalIP = context.request.ip?.startsWith('192.168.') ?? false;
 *
 *     return isWorkingHours || (isAdmin && isInternalIP);
 *   }
 * };
 *
 * // 条件组合使用
 * const combinedCondition: PolicyCondition = {
 *   type: 'field',
 *   field: 'resource.priority',
 *   operator: 'lte',
 *   value: 5
 * };
 * ```
 */
export interface PolicyCondition {
  /** 条件类型 */
  type: PolicyConditionType;
  /** 要检查的字段路径（field 类型时必需） */
  field?: string;
  /** 条件操作符（field 类型时必需） */
  operator?: string;
  /** 期望值（field 类型时必需） */
  value?: unknown;
  /** 自定义评估函数（custom 类型时必需） */
  fn?: (context: PolicyEvaluationContext) => boolean | Promise<boolean>;
}

/**
 * 策略规则
 * 定义策略的具体规则
 *
 * @example
 * ```typescript
 * // 允许规则
 * const allowRule: PolicyRule = {
 *   permissions: ['user:read', 'user:update'],
 *   effect: 'allow',
 *   conditions: [{
 *     field: 'subject.roles',
 *     operator: 'contains',
 *     value: 'manager'
 *   }],
 *   priority: 'normal',
 *   description: '经理可以查看和更新用户'
 * };
 *
 * // 拒绝规则
 * const denyRule: PolicyRule = {
 *   permissions: ['*'],
 *   effect: 'deny',
 *   conditions: [{
 *     field: 'resource.status',
 *     operator: 'eq',
 *     value: 'suspended'
 *   }],
 *   priority: 'high',
 *   description: '禁止访问已暂停的资源'
 * };
 *
 * // 通配符规则
 * const wildcardRule: PolicyRule = {
 *   permissions: ['*'],  // 所有权限
 *   effect: 'allow',
 *   priority: 'low',
 *   description: '默认允许所有操作'
 * };
 *
 * // 资源级规则
 * const resourceRule: PolicyRule = {
 *   permissions: ['user:*'],  // 用户资源的所有操作
 *   effect: 'allow',
 *   conditions: [{
 *     field: 'resource.ownerId',
 *     operator: 'eq',
 *     value: 'subject.id'
 *   }],
 *   description: '用户可以操作自己的资源'
 * };
 * ```
 */
export interface PolicyRule {
  /** 权限列表 */
  permissions: string[];
  /** 策略效果 */
  effect: PolicyEffect;
  /** 条件列表（可选） */
  conditions?: PolicyCondition[];
  /** 规则优先级（可选，默认为 normal） */
  priority?: PolicyPriority;
  /** 规则描述（可选） */
  description?: string;
}

/**
 * 策略定义
 * 描述一个完整的策略
 *
 * @example
 * ```typescript
 * // 简单策略
 * const simplePolicy: PolicyDefinition = {
 *   id: 'working-hours',
 *   name: '工作时间策略',
 *   description: '仅允许工作时间访问',
 *   rules: [{
 *     permissions: ['*'],
 *     effect: 'allow',
 *     conditions: [{
 *       type: 'time',
 *       operator: 'between',
 *       value: { start: '09:00', end: '18:00' }
 *     }]
 *   }],
 *   priority: 'normal',
 *   enabled: true
 * };
 *
 * // 租户特定策略
 * const tenantPolicy: PolicyDefinition = {
 *   id: 'tenant-isolation',
 *   name: '租户隔离策略',
 *   description: '确保用户只能访问自己租户的数据',
 *   rules: [{
 *     permissions: ['*'],
 *     effect: 'allow',
 *     conditions: [{
 *       type: 'field',
 *       field: 'resource.tenantId',
 *       operator: 'eq',
 *       value: 'tenant.id'
 *     }]
 *   }],
 *   priority: 'high',
 *   enabled: true,
 *   tenantId: 'specific-tenant-id',  // 仅适用于特定租户
 *   metadata: {
 *     createdBy: 'system',
 *     category: 'security'
 *   }
 * };
 *
 * // 复杂策略
 * const complexPolicy: PolicyDefinition = {
 *   id: 'role-based-access',
 *   name: '基于角色的访问控制',
 *   rules: [
 *     {
 *       permissions: ['admin:*'],
 *       effect: 'allow',
 *       conditions: [{
 *         field: 'subject.roles',
 *         operator: 'contains',
 *         value: 'admin'
 *       }],
 *       priority: 'high'
 *     },
 *     {
 *       permissions: ['user:read', 'user:update'],
 *       effect: 'allow',
 *       conditions: [{
 *         field: 'subject.roles',
 *         operator: 'contains',
 *         value: 'user'
 *       }],
 *       priority: 'normal'
 *     },
 *     {
 *       permissions: ['*'],
 *       effect: 'deny',
 *       priority: 'low'
 *     }
 *   ],
 *   priority: 'high',
 *   enabled: true,
 *   metadata: {
 *     version: '1.0',
 *     lastModified: new Date()
 *   }
 * };
 * ```
 */
export interface PolicyDefinition {
  /** 策略唯一标识符 */
  id: string;
  /** 策略名称 */
  name: string;
  /** 策略描述（可选） */
  description?: string;
  /** 策略规则列表 */
  rules: PolicyRule[];
  /** 策略优先级（可选，默认为 normal） */
  priority: PolicyPriority;
  /** 策略是否启用 */
  enabled: boolean;
  /** 策略适用的租户 ID（可选，为空时适用于所有租户） */
  tenantId?: string;
  /** 额外元数据（可选） */
  metadata?: Record<string, unknown>;
}

/**
 * 编译后的策略
 * 用于高效执行的策略格式
 *
 * @example
 * ```typescript
 * // 编译后的策略包含优化后的数据结构
 * const compiledPolicy: CompiledPolicy = {
 *   id: 'working-hours',
 *   name: '工作时间策略',
 *   rules: [
 *     {
 *       permissions: new Set(['*']),
 *       effect: 'allow',
 *       conditions: [...],
 *       priority: 100,
 *       evaluate: async (context) => {
 *         // 优化后的评估逻辑
 *         return checkTimeCondition(context);
 *       }
 *     }
 *   ],
 *   priority: 100,
 *   enabled: true,
 *   tenantId: 'tenant-1'
 * };
 * ```
 */
export interface CompiledPolicy {
  /** 策略 ID */
  readonly id: string;
  /** 策略名称 */
  readonly name: string;
  /** 编译后的规则列表 */
  readonly rules: CompiledPolicyRule[];
  /** 数值优先级（用于快速排序） */
  readonly priority: number;
  /** 是否启用 */
  readonly enabled: boolean;
  /** 适用的租户 ID（可选） */
  readonly tenantId?: string;
}

/**
 * 编译后的策略规则
 * 优化后的规则格式，包含快速评估函数
 *
 * @example
 * ```typescript
 * const compiledRule: CompiledPolicyRule = {
 *   permissions: new Set(['user:create', 'user:read', 'user:update']),
 *   effect: 'allow',
 *   conditions: [...],
 *   priority: 100,
 *   evaluate: async (context) => {
 *     // 预编译的评估逻辑
 *     for (const condition of conditions) {
 *       const result = await condition.evaluate(context);
 *       if (!result) return false;
 *     }
 *     return true;
 *   }
 * };
 * ```
 */
export interface CompiledPolicyRule {
  /** 权限集合（Set 用于快速查找） */
  readonly permissions: Set<string>;
  /** 策略效果 */
  readonly effect: PolicyEffect;
  /** 条件列表 */
  readonly conditions: PolicyCondition[];
  /** 数值优先级 */
  readonly priority: number;
  /** 预编译的评估函数 */
  readonly evaluate: (context: PolicyEvaluationContext) => Promise<boolean>;
}

/**
 * 策略评估上下文
 * 包含策略评估所需的所有信息
 *
 * @example
 * ```typescript
 * // 完整的评估上下文
 * const evaluationContext: PolicyEvaluationContext = {
 *   tenant: {
 *     id: 'tenant-1',
 *     status: 'active'
 *   },
 *   subject: {
 *     id: 'user-123',
 *     type: 'user',
 *     roles: ['manager'],
 *     permissions: ['user:read']
 *   },
 *   request: {
 *     requestId: 'req-abc-123',
 *     timestamp: new Date(),
 *     ip: '192.168.1.100',
 *     path: '/api/users/456',
 *     method: 'PUT'
 *   },
 *   permission: {
 *     code: 'user:update',
 *     resource: 'user',
 *     action: 'update',
 *     scope: 'tenant',
 *     description: '更新用户',
 *     conditions: [],
 *     metadata: {}
 *   },
 *   resource: {
 *     id: '456',
 *     ownerId: 'user-123',
 *     status: 'active',
 *     tenantId: 'tenant-1'
 *   },
 *   environment: {
 *     config: 'production',
 *     version: '2.0'
 *   }
 * };
 * ```
 */
export interface PolicyEvaluationContext {
  /** 租户上下文 */
  tenant: TenantContext;
  /** 主体上下文 */
  subject: SubjectContext;
  /** 请求上下文 */
  request: RequestContext;
  /** 要检查的权限 */
  permission: Permission;
  /** 资源数据（可选） */
  resource?: Record<string, unknown>;
  /** 环境变量（可选） */
  environment?: Record<string, unknown>;
}

/**
 * 策略评估结果
 * 返回策略评估的详细结果
 *
 * @example
 * ```typescript
 * // 允许访问
 * const allowResult: PolicyEvaluationResult = {
 *   effect: 'allow',
 *   matchedPolicy: 'working-hours-policy',
 *   matchedRule: 0,
 *   conditions: {
 *     passed: [timeCondition],
 *     failed: []
 *   },
 *   evaluationPath: ['policy:working-hours-policy', 'rule:0']
 * };
 *
 * // 拒绝访问
 * const denyResult: PolicyEvaluationResult = {
 *   effect: 'deny',
 *   matchedPolicy: 'security-policy',
 *   matchedRule: 1,
 *   conditions: {
 *     passed: [],
 *     failed: [ipCondition]
 *   },
 *   evaluationPath: ['policy:security-policy', 'rule:1']
 * };
 *
 * // 默认拒绝（无匹配策略）
 * const defaultDenyResult: PolicyEvaluationResult = {
 *   effect: 'deny',
 *   evaluationPath: []
 * };
 * ```
 */
export interface PolicyEvaluationResult {
  /** 策略效果 */
  effect: PolicyEffect;
  /** 匹配的策略 ID（可选） */
  matchedPolicy?: string;
  /** 匹配的规则索引（可选） */
  matchedRule?: number;
  /** 条件评估结果（可选） */
  conditions?: {
    /** 通过的条件列表 */
    passed: PolicyCondition[];
    /** 失败的条件列表 */
    failed: PolicyCondition[];
  };
  /** 评估路径（可选，用于调试） */
  evaluationPath?: string[];
}

/**
 * 策略引擎接口
 * 定义策略管理的核心操作
 *
 * @example
 * ```typescript
 * // 创建策略引擎实例
 * const policyEngine: PolicyEngine = new DefaultPolicyEngine();
 *
 * // 添加策略
 * policyEngine.addPolicy(workingHoursPolicy);
 * policyEngine.addPolicy(securityPolicy);
 *
 * // 评估策略
 * const result = await policyEngine.evaluate({
 *   tenant: { id: 'tenant-1' },
 *   subject: { id: 'user-123', type: 'user' },
 *   request: { timestamp: new Date() },
 *   permission: { code: 'user:update', resource: 'user', action: 'update' }
 * });
 *
 * if (result.effect === 'allow') {
 *   // 允许访问
 * } else {
 *   // 拒绝访问
 * }
 *
 * // 管理策略
 * const policy = policyEngine.getPolicy('working-hours-policy');
 * if (policy) {
 *   policyEngine.removePolicy('working-hours-policy');
 * }
 *
 * // 列出策略
 * const allPolicies = policyEngine.listPolicies();
 * const tenantPolicies = policyEngine.listPolicies('tenant-1');
 *
 * // 编译策略
 * const compiled = policyEngine.compile(customPolicy);
 * ```
 */
export interface PolicyEngine {
  /** 评估策略 */
  evaluate(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult>;
  /** 添加策略 */
  addPolicy(policy: PolicyDefinition): void;
  /** 移除策略 */
  removePolicy(policyId: string): void;
  /** 获取策略 */
  getPolicy(policyId: string): PolicyDefinition | undefined;
  /** 列出策略 */
  listPolicies(tenantId?: string): PolicyDefinition[];
  /** 编译策略 */
  compile(policy: PolicyDefinition): CompiledPolicy;
}

/**
 * 策略提供器接口
 * 用于从外部源获取策略
 *
 * @example
 * ```typescript
 * // 数据库策略提供器
 * class DatabasePolicyProvider implements PolicyProvider {
 *   async getPolicies(tenantId: string, subjectId: string): Promise<PolicyDefinition[]> {
 *     const policies = await db.query(`
 *       SELECT * FROM policies
 *       WHERE tenant_id = ? AND enabled = true
 *     `, [tenantId]);
 *
 *     return policies.map(row => ({
 *       id: row.id,
 *       name: row.name,
 *       // ... 映射其他字段
 *     }));
 *   }
 *
 *   async invalidate(tenantId: string, subjectId?: string): Promise<void> {
 *     // 清除缓存
 *     await cache.delete(`policies:${tenantId}`);
 *   }
 * }
 *
 * // 使用策略提供器
 * const provider = new DatabasePolicyProvider();
 * const policies = await provider.getPolicies('tenant-1', 'user-123');
 * ```
 */
export interface PolicyProvider {
  /** 获取策略 */
  getPolicies(tenantId: string, subjectId: string): Promise<PolicyDefinition[]>;
  /** 使策略缓存失效 */
  invalidate(tenantId: string, subjectId?: string): Promise<void>;
}
