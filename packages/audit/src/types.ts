import type { MTPCContext } from '@mtpc/core';

/**
 * 审计动作分类
 */
export type AuditCategory =
  | 'permission' // 权限检查
  | 'resource' // 资源CRUD操作
  | 'role' // 角色/RBAC变更
  | 'policy' // 策略变更
  | 'system' // 系统级事件
  | 'custom'; // 自定义事件

/**
 * 审计决策/结果
 */
export type AuditDecision = 'allow' | 'deny' | 'error' | 'info';

/**
 * 审计条目 - 记录系统中的所有审计事件
 */
export interface AuditEntry {
  id: string; // 唯一标识符
  tenantId: string; // 租户ID，多租户环境下的标识
  timestamp: Date; // 事件发生时间

  // 谁：操作主体信息
  subjectId?: string; // 主体ID，如用户ID
  subjectType?: string; // 主体类型，如'user'、'system'

  // 什么：操作内容
  category: AuditCategory; // 审计分类
  action: string; // 具体动作，如"check", "create", "update", "delete"
  resource?: string; // 资源名称
  resourceId?: string; // 资源标识符
  permission?: string; // 权限编码

  // 结果：操作结果
  decision: AuditDecision; // 决策结果
  success: boolean; // 是否成功
  reason?: string; // 原因说明

  // 状态：资源变更前后状态
  before?: unknown; // 操作前状态
  after?: unknown; // 操作后状态

  // 请求上下文
  ip?: string; // 请求IP地址
  userAgent?: string; // 用户代理
  requestId?: string; // 请求ID
  path?: string; // 请求路径
  method?: string; // 请求方法

  // 额外数据
  metadata?: Record<string, unknown>; // 自定义元数据
}

/**
 * 审计条目输入 - 创建审计记录时的输入类型，不包含自动生成的id和timestamp
 */
export type AuditEntryInput = Omit<AuditEntry, 'id' | 'timestamp'> & {
  timestamp?: Date; // 可选的自定义时间戳
};

/**
 * 审计查询过滤器 - 用于筛选审计记录
 */
export interface AuditQueryFilter {
  tenantId?: string; // 租户ID筛选
  subjectId?: string; // 主体ID筛选
  resource?: string; // 资源名称筛选
  resourceId?: string; // 资源标识符筛选
  category?: AuditCategory; // 审计分类筛选
  decision?: AuditDecision; // 决策结果筛选
  action?: string; // 动作筛选
  permission?: string; // 权限编码筛选
  from?: Date; // 起始时间
  to?: Date; // 结束时间
}

/**
 * 审计查询选项 - 包含筛选条件、分页和排序
 */
export interface AuditQueryOptions {
  filter?: AuditQueryFilter; // 查询过滤器
  limit?: number; // 每页数量
  offset?: number; // 偏移量
  orderBy?: 'timestamp' | 'tenant' | 'subject'; // 排序字段
  orderDirection?: 'asc' | 'desc'; // 排序方向
}

/**
 * 审计查询结果 - 包含查询到的审计条目和分页信息
 */
export interface AuditQueryResult {
  entries: AuditEntry[]; // 审计条目列表
  total: number; // 总条数
  limit: number; // 当前页数量
  offset: number; // 当前偏移量
}

/**
 * 审计存储接口 - 与具体存储实现无关的抽象接口
 */
export interface AuditStore {
  /**
   * 记录审计条目
   * @param entry 审计条目
   */
  log(entry: AuditEntry): Promise<void>;
  
  /**
   * 查询审计记录
   * @param options 查询选项
   * @returns 查询结果
   */
  query(options?: AuditQueryOptions): Promise<AuditQueryResult>;
  
  /**
   * 统计审计记录数量
   * @param filter 筛选条件
   * @returns 记录数量
   */
  count(filter?: AuditQueryFilter): Promise<number>;
  
  /**
   * 清除审计记录
   * @param filter 筛选条件
   */
  clear(filter?: AuditQueryFilter): Promise<void>;
}

/**
 * 审计选项 - 配置审计系统的行为
 */
export interface AuditOptions {
  store?: AuditStore; // 审计存储实现
  async?: boolean; // 是否异步记录（默认true）
  mask?: (entry: AuditEntry) => AuditEntry; // 审计数据掩码函数，用于敏感数据处理
  include?: {
    permissionChecks?: boolean; // 是否记录权限检查
    resourceOperations?: boolean; // 是否记录资源操作
    roleChanges?: boolean; // 是否记录角色变更
    policyChanges?: boolean; // 是否记录策略变更
  };
}

/**
 * 标准化审计上下文 - 从MTPCContext转换而来的审计上下文
 */
export interface NormalizedAuditContext {
  tenantId: string; // 租户ID
  subjectId?: string; // 主体ID
  subjectType?: string; // 主体类型
  ip?: string; // IP地址
  userAgent?: string; // 用户代理
  requestId?: string; // 请求ID
  path?: string; // 请求路径
  method?: string; // 请求方法
}

/**
 * 审计插件状态 - 存储审计插件的内部状态
 */
export interface AuditPluginState {
  store: AuditStore; // 审计存储实例
  options: AuditOptions; // 审计配置选项
}

/**
 * 审计日志器接口 - 高级API，用于记录各种审计事件
 */
export interface AuditLogger {
  /**
   * 记录权限检查事件
   * @param params 权限检查参数
   */
  logPermissionCheck(params: {
    ctx: MTPCContext; // MTPC上下文
    permission: string; // 权限编码
    resource?: string; // 资源名称
    resourceId?: string; // 资源标识符
    decision: AuditDecision; // 决策结果
    success: boolean; // 是否成功
    reason?: string; // 原因说明
    metadata?: Record<string, unknown>; // 自定义元数据
  }): Promise<void>;

  /**
   * 记录资源操作事件
   * @param params 资源操作参数
   */
  logResourceOperation(params: {
    ctx: MTPCContext; // MTPC上下文
    operation: string; // 操作类型，如"create" | "read" | "update" | "delete"
    resource: string; // 资源名称
    resourceId?: string; // 资源标识符
    success: boolean; // 是否成功
    before?: unknown; // 操作前状态
    after?: unknown; // 操作后状态
    reason?: string; // 原因说明
    metadata?: Record<string, unknown>; // 自定义元数据
  }): Promise<void>;

  /**
   * 记录角色变更事件
   * @param params 角色变更参数
   */
  logRoleChange(params: {
    ctx: MTPCContext; // MTPC上下文
    action: string; // 动作类型，如"assign" | "revoke" | "createRole"
    subjectId?: string; // 主体ID
    role?: string; // 角色名称
    success: boolean; // 是否成功
    reason?: string; // 原因说明
    metadata?: Record<string, unknown>; // 自定义元数据
  }): Promise<void>;

  /**
   * 记录策略变更事件
   * @param params 策略变更参数
   */
  logPolicyChange(params: {
    ctx: MTPCContext; // MTPC上下文
    action: string; // 动作类型，如"createPolicy" | "updatePolicy"
    policyId?: string; // 策略ID
    success: boolean; // 是否成功
    reason?: string; // 原因说明
    metadata?: Record<string, unknown>; // 自定义元数据
  }): Promise<void>;

  /**
   * 记录自定义事件
   * @param params 自定义事件参数
   */
  logCustom(params: {
    ctx: MTPCContext; // MTPC上下文
    category?: AuditCategory; // 审计分类，默认为'custom'
    action: string; // 动作类型
    resource?: string; // 资源名称
    resourceId?: string; // 资源标识符
    decision?: AuditDecision; // 决策结果
    success?: boolean; // 是否成功
    reason?: string; // 原因说明
    metadata?: Record<string, unknown>; // 自定义元数据
  }): Promise<void>;

  /**
   * 查询审计记录
   * @param options 查询选项
   * @returns 查询结果
   */
  query(options?: AuditQueryOptions): Promise<AuditQueryResult>;
  
  /**
   * 统计审计记录数量
   * @param filter 筛选条件
   * @returns 记录数量
   */
  count(filter?: AuditQueryFilter): Promise<number>;
  
  /**
   * 清除审计记录
   * @param filter 筛选条件
   */
  clear(filter?: AuditQueryFilter): Promise<void>;
}
