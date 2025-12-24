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
  /** 唯一标识符 */
  id: string; 
  /** 租户ID */
  tenantId: string; 
  /** 事件发生时间 */
  timestamp: Date; 

  // 谁：操作主体信息
  /** 主体ID，如用户ID */
  subjectId?: string; 
  /** 主体类型，如'user'、'system' */
  subjectType?: string; 

  // 什么：操作内容
  /** 审计分类 */
  category: AuditCategory; 
  /** 具体动作，如"check", "create", "update", "delete" */
  action: string; 
  /** 资源名称 */
  resource?: string; 
  /** 资源标识符 */
  resourceId?: string; 
  /** 权限编码 */
  permission?: string; 

  // 结果：操作结果
  /** 决策结果 */
  decision: AuditDecision; 
  /** 是否成功 */
  success: boolean; 
  /** 原因说明 */
  reason?: string; 

  // 状态：资源变更前后状态
  /** 操作前状态 */
  before?: unknown; 
  /** 操作后状态 */
  after?: unknown; 

  // 请求上下文
  /** 请求IP地址 */
  ip?: string; 
  /** 用户代理 */
  userAgent?: string; 
  /** 请求ID */
  requestId?: string; 
  /** 请求路径 */
  path?: string; 
  /** 请求方法 */
  method?: string; 

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
  /** 租户ID筛选 */
  tenantId?: string; 
  /** 主体ID筛选 */
  subjectId?: string; 
  /** 资源名称筛选 */
  resource?: string; 
  /** 资源标识符筛选 */
  resourceId?: string; 
  /** 审计分类筛选 */
  category?: AuditCategory; 
  /** 决策结果筛选 */
  decision?: AuditDecision; 
  /** 动作筛选 */
  action?: string; 
  /** 权限编码筛选 */
  permission?: string; 
  /** 起始时间 */
  from?: Date; 
  /** 结束时间 */
  to?: Date; 
}

/**
 * 审计查询选项 - 包含筛选条件、分页和排序
 */
export interface AuditQueryOptions {
  /** 查询过滤器 */
  filter?: AuditQueryFilter; 
  /** 每页数量 */
  limit?: number; 
  /** 偏移量 */
  offset?: number; 
  /** 排序字段 */
  orderBy?: 'timestamp' | 'tenant' | 'subject'; 
  /** 排序方向 */
  orderDirection?: 'asc' | 'desc'; 
}

/**
 * 审计查询结果 - 包含查询到的审计条目和分页信息
 */
export interface AuditQueryResult {
  /** 审计条目列表 */
  entries: AuditEntry[]; 
  /** 总条数 */
  total: number; 
  /** 当前页数量 */
  limit: number; 
  /** 当前偏移量 */
  offset: number; 
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
  /** 审计存储实现 */
  store?: AuditStore; 
  /** 是否异步记录（默认true） */
  async?: boolean; 
  /** 审计数据掩码函数，用于敏感数据处理 */
  mask?: (entry: AuditEntry) => AuditEntry; 
  /** 包含的审计事件类型 */
  include?: {
    /** 是否记录权限检查 */
    permissionChecks?: boolean; 
    /** 是否记录资源操作 */
    resourceOperations?: boolean; 
    /** 是否记录角色变更 */
    roleChanges?: boolean; 
    /** 是否记录策略变更 */
    policyChanges?: boolean; 
  };
}

/**
 * 标准化审计上下文 - 从MTPCContext转换而来的审计上下文
 */
export interface NormalizedAuditContext {
  /** 租户ID */
  tenantId: string; // 租户ID
  /** 主体ID */
  subjectId?: string; // 主体ID
  /** 主体类型 */
  subjectType?: string; // 主体类型
  /** IP地址 */
  ip?: string; // IP地址
  /** 用户代理 */
  userAgent?: string; // 用户代理
  /** 请求ID */
  requestId?: string; // 请求ID
  /** 请求路径 */
  path?: string; // 请求路径
  /** 请求方法 */
  method?: string; // 请求方法
}

/**
 * 审计插件状态 - 存储审计插件的内部状态
 */
export interface AuditPluginState {
  /** 审计存储实例 */
  store: AuditStore; 
  /** 审计配置选项 */
  options: AuditOptions; 
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
    /** MTPC上下文 */
    ctx: MTPCContext; 
    /** 权限编码 */
    permission: string; 
    /** 资源名称 */
    resource?: string; 
    /** 资源标识符 */
    resourceId?: string; 
    /** 决策结果 */
    decision: AuditDecision; 
    /** 是否成功 */
    success: boolean; 
    /** 原因说明 */
    reason?: string; 
    /** 自定义元数据 */
    metadata?: Record<string, unknown>; 
  }): Promise<void>;

  /**
   * 记录资源操作事件
   * @param params 资源操作参数
   */
  logResourceOperation(params: {
    /** MTPC上下文 */
    ctx: MTPCContext; 
    /** 操作类型，如"create" | "read" | "update" | "delete" */
    operation: string; 
    /** 资源名称 */
    resource: string; 
    /** 资源标识符 */
    resourceId?: string; 
    /** 是否成功 */
    success: boolean; 
    /** 操作前状态 */
    before?: unknown; 
    /** 操作后状态 */
    after?: unknown; 
    /** 原因说明 */
    reason?: string; 
    /** 自定义元数据 */
    metadata?: Record<string, unknown>; 
  }): Promise<void>;

  /**
   * 记录角色变更事件
   * @param params 角色变更参数
   */
  logRoleChange(params: {
    /** MTPC上下文 */
    ctx: MTPCContext; 
    /** 动作类型，如"assign" | "revoke" | "createRole" */
    action: string; 
    /** 主体ID */
    subjectId?: string; 
    /** 角色名称 */
    role?: string; 
    /** 是否成功 */
    success: boolean; 
    /** 原因说明 */
    reason?: string; 
    /** 自定义元数据 */
    metadata?: Record<string, unknown>; 
  }): Promise<void>;

  /**
   * 记录策略变更事件
   * @param params 策略变更参数
   */
  logPolicyChange(params: {
    /** MTPC上下文 */
    ctx: MTPCContext; 
    /** 动作类型，如"createPolicy" | "updatePolicy" */
    action: string; 
    /** 策略ID */
    policyId?: string; 
    /** 是否成功 */
    success: boolean; 
    /** 原因说明 */
    reason?: string; 
    /** 自定义元数据 */
    metadata?: Record<string, unknown>; 
  }): Promise<void>;

  /**
   * 记录自定义事件
   * @param params 自定义事件参数
   */
  logCustom(params: {
    /** MTPC上下文 */
    ctx: MTPCContext; 
    /** 审计分类，默认为'custom' */
    category?: AuditCategory; 
    /** 动作类型 */
    action: string; 
    /** 资源名称 */
    resource?: string; 
    /** 资源标识符 */
    resourceId?: string; 
    /** 决策结果 */
    decision?: AuditDecision; 
    /** 是否成功 */
    success?: boolean; 
    /** 原因说明 */
    reason?: string; 
    /** 自定义元数据 */
    metadata?: Record<string, unknown>; 
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
