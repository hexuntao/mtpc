// @mtpc/audit - MTPC 的审计日志扩展

import type { MTPCContext } from '@mtpc/core';
import { InMemoryAuditStore } from './store/memory-store.js';
import type {
  AuditCategory,
  AuditDecision,
  AuditEntry,
  AuditEntryInput,
  AuditLogger,
  AuditOptions,
  AuditQueryFilter,
  AuditQueryOptions,
  AuditQueryResult,
  AuditStore,
} from './types.js';

/**
 * 将 MTPC 上下文转换为审计字段
 * @param ctx MTPC 上下文对象
 * @returns 规范化的审计字段
 */
function normalizeContextFields(ctx: MTPCContext): {
  tenantId: string;
  subjectId?: string;
  subjectType?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  path?: string;
  method?: string;
} {
  return {
    tenantId: ctx.tenant.id,
    subjectId: ctx.subject.id,
    subjectType: ctx.subject.type,
    ip: ctx.request.ip,
    userAgent: ctx.request.userAgent,
    requestId: ctx.request.requestId,
    path: ctx.request.path,
    method: ctx.request.method,
  };
}

/**
 * Audit 服务 - 高级日志记录 API
 * 负责记录和查询审计日志，支持多种审计事件类型
 */
export class Audit implements AuditLogger {
  private store: AuditStore; // 审计日志存储
  private options: AuditOptions; // 审计配置选项
  private idCounter = 0; // 用于生成唯一 ID 的计数器

  /**
   * 构造函数
   * @param options 审计配置选项
   */
  constructor(options: AuditOptions = {}) {
    this.options = options;
    // 如果没有提供存储，则使用内存存储（仅用于测试/演示）
    this.store = options.store ?? new InMemoryAuditStore();
  }

  /**
   * 生成唯一 ID
   * @returns 唯一的审计日志 ID
   */
  private generateId(): string {
    return `audit_${++this.idCounter}_${Date.now()}`;
  }

  /**
   * 内部日志记录方法
   * 负责生成 ID、应用掩码和存储日志条目
   * @param entryInput 审计日志输入
   */
  private async logInternal(entryInput: AuditEntryInput): Promise<void> {
    // 创建完整的审计日志条目
    const entry: AuditEntry = {
      id: this.generateId(),
      timestamp: entryInput.timestamp ?? new Date(),
      ...entryInput,
    };

    // 应用掩码（如果配置了）
    const masked = this.options.mask ? this.options.mask(entry) : entry;

    // 根据配置决定是异步还是同步记录日志
    if (this.options.async) {
      // 异步记录（即发即弃）
      this.store.log(masked);
    } else {
      // 同步记录
      await this.store.log(masked);
    }
  }

  /**
   * 记录权限检查事件
   * @param params 权限检查参数
   */
  async logPermissionCheck(params: {
    ctx: MTPCContext;
    permission: string;
    resource?: string;
    resourceId?: string;
    decision: AuditDecision;
    success: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // 如果配置了不记录权限检查，则直接返回
    if (this.options.include?.permissionChecks === false) {
      return;
    }

    // 规范化上下文字段
    const norm = normalizeContextFields(params.ctx);
    // 解析权限代码为资源和操作
    const [res, act] = params.permission.split(':');

    // 记录权限检查事件
    await this.logInternal({
      tenantId: norm.tenantId,
      subjectId: norm.subjectId,
      subjectType: norm.subjectType,
      category: 'permission',
      action: 'check',
      resource: params.resource ?? res,
      resourceId: params.resourceId,
      permission: params.permission,
      decision: params.decision,
      success: params.success,
      reason: params.reason,
      ip: norm.ip,
      userAgent: norm.userAgent,
      requestId: norm.requestId,
      path: norm.path,
      method: norm.method,
      metadata: {
        ...params.metadata,
        action: act,
      },
    });
  }

  /**
   * 记录资源操作事件
   * @param params 资源操作参数
   */
  async logResourceOperation(params: {
    ctx: MTPCContext;
    operation: string;
    resource: string;
    resourceId?: string;
    success: boolean;
    before?: unknown;
    after?: unknown;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // 如果配置了不记录资源操作，则直接返回
    if (this.options.include?.resourceOperations === false) {
      return;
    }

    // 规范化上下文字段
    const norm = normalizeContextFields(params.ctx);

    // 记录资源操作事件
    await this.logInternal({
      tenantId: norm.tenantId,
      subjectId: norm.subjectId,
      subjectType: norm.subjectType,
      category: 'resource',
      action: params.operation,
      resource: params.resource,
      resourceId: params.resourceId,
      decision: params.success ? 'info' : 'error',
      success: params.success,
      reason: params.reason,
      before: params.before,
      after: params.after,
      ip: norm.ip,
      userAgent: norm.userAgent,
      requestId: norm.requestId,
      path: norm.path,
      method: norm.method,
      metadata: params.metadata,
    });
  }

  /**
   * 记录角色变更事件
   * @param params 角色变更参数
   */
  async logRoleChange(params: {
    ctx: MTPCContext;
    action: string;
    subjectId?: string;
    role?: string;
    success: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // 如果配置了不记录角色变更，则直接返回
    if (this.options.include?.roleChanges === false) {
      return;
    }

    // 规范化上下文字段
    const norm = normalizeContextFields(params.ctx);

    // 记录角色变更事件
    await this.logInternal({
      tenantId: norm.tenantId,
      subjectId: norm.subjectId,
      subjectType: norm.subjectType,
      category: 'role',
      action: params.action,
      resource: 'role',
      resourceId: params.role,
      decision: params.success ? 'info' : 'error',
      success: params.success,
      reason: params.reason,
      ip: norm.ip,
      userAgent: norm.userAgent,
      requestId: norm.requestId,
      path: norm.path,
      method: norm.method,
      metadata: {
        ...params.metadata,
        targetSubjectId: params.subjectId,
        role: params.role,
      },
    });
  }

  /**
   * 记录策略变更事件
   * @param params 策略变更参数
   */
  async logPolicyChange(params: {
    ctx: MTPCContext;
    action: string;
    policyId?: string;
    success: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // 如果配置了不记录策略变更，则直接返回
    if (this.options.include?.policyChanges === false) {
      return;
    }

    // 规范化上下文字段
    const norm = normalizeContextFields(params.ctx);

    // 记录策略变更事件
    await this.logInternal({
      tenantId: norm.tenantId,
      subjectId: norm.subjectId,
      subjectType: norm.subjectType,
      category: 'policy',
      action: params.action,
      resource: 'policy',
      resourceId: params.policyId,
      decision: params.success ? 'info' : 'error',
      success: params.success,
      reason: params.reason,
      ip: norm.ip,
      userAgent: norm.userAgent,
      requestId: norm.requestId,
      path: norm.path,
      method: norm.method,
      metadata: params.metadata,
    });
  }

  /**
   * 记录自定义审计事件
   * @param params 自定义事件参数
   */
  async logCustom(params: {
    ctx: MTPCContext;
    category?: AuditCategory;
    action: string;
    resource?: string;
    resourceId?: string;
    decision?: AuditDecision;
    success?: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // 规范化上下文字段
    const norm = normalizeContextFields(params.ctx);

    // 记录自定义事件
    await this.logInternal({
      tenantId: norm.tenantId,
      subjectId: norm.subjectId,
      subjectType: norm.subjectType,
      category: params.category ?? 'custom',
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      decision: params.decision ?? (params.success === false ? 'error' : 'info'),
      success: params.success ?? true,
      reason: params.reason,
      ip: norm.ip,
      userAgent: norm.userAgent,
      requestId: norm.requestId,
      path: norm.path,
      method: norm.method,
      metadata: params.metadata,
    });
  }

  /**
   * 查询审计日志
   * @param options 查询选项
   * @returns 查询结果
   */
  async query(options?: AuditQueryOptions): Promise<AuditQueryResult> {
    return this.store.query(options);
  }

  /**
   * 统计审计日志数量
   * @param filter 查询过滤器
   * @returns 符合条件的日志数量
   */
  async count(filter?: AuditQueryFilter): Promise<number> {
    return this.store.count(filter);
  }

  /**
   * 清除审计日志
   * @param filter 查询过滤器，为空则清除所有日志
   */
  async clear(filter?: AuditQueryFilter): Promise<void> {
    await this.store.clear(filter);
  }

  /**
   * 获取底层存储实例
   * @returns 审计日志存储实例
   */
  getStore(): AuditStore {
    return this.store;
  }
}

/**
 * 创建审计日志记录器实例
 * @param options 审计配置选项
 * @returns 审计日志记录器实例
 */
export function createAudit(options?: AuditOptions): Audit {
  return new Audit(options);
}
