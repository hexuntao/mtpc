import type { AuditEntry, AuditQueryFilter } from './types.js';

/**
 * 审计过滤器构建器 - 用于流畅地构建审计查询过滤器
 *
 * 示例用法：
 * ```
 * const filter = createAuditFilter()
 *   .tenant('tenant123')
 *   .category('permission')
 *   .decision('deny')
 *   .from(new Date('2023-01-01'))
 *   .build();
 * ```
 */
export class AuditFilterBuilder {
  private filter: AuditQueryFilter = {}; // 内部存储的过滤条件

  /**
   * 设置租户ID过滤条件
   * @param tenantId 租户ID
   * @returns 构建器实例，用于链式调用
   */
  tenant(tenantId: string): this {
    this.filter.tenantId = tenantId;
    return this;
  }

  /**
   * 设置主体ID过滤条件
   * @param subjectId 主体ID，如用户ID
   * @returns 构建器实例，用于链式调用
   */
  subject(subjectId: string): this {
    this.filter.subjectId = subjectId;
    return this;
  }

  /**
   * 设置资源名称过滤条件
   * @param resource 资源名称
   * @returns 构建器实例，用于链式调用
   */
  resource(resource: string): this {
    this.filter.resource = resource;
    return this;
  }

  /**
   * 设置资源ID过滤条件
   * @param resourceId 资源标识符
   * @returns 构建器实例，用于链式调用
   */
  resourceId(resourceId: string): this {
    this.filter.resourceId = resourceId;
    return this;
  }

  /**
   * 设置审计分类过滤条件
   * @param category 审计分类
   * @returns 构建器实例，用于链式调用
   */
  category(category: AuditEntry['category']): this {
    this.filter.category = category;
    return this;
  }

  /**
   * 设置决策结果过滤条件
   * @param decision 决策结果，如'allow'、'deny'等
   * @returns 构建器实例，用于链式调用
   */
  decision(decision: AuditEntry['decision']): this {
    this.filter.decision = decision;
    return this;
  }

  /**
   * 设置动作类型过滤条件
   * @param action 动作类型，如'check'、'create'等
   * @returns 构建器实例，用于链式调用
   */
  action(action: string): this {
    this.filter.action = action;
    return this;
  }

  /**
   * 设置权限编码过滤条件
   * @param permission 权限编码
   * @returns 构建器实例，用于链式调用
   */
  permission(permission: string): this {
    this.filter.permission = permission;
    return this;
  }

  /**
   * 设置起始时间过滤条件
   * @param date 起始时间
   * @returns 构建器实例，用于链式调用
   */
  from(date: Date): this {
    this.filter.from = date;
    return this;
  }

  /**
   * 设置结束时间过滤条件
   * @param date 结束时间
   * @returns 构建器实例，用于链式调用
   */
  to(date: Date): this {
    this.filter.to = date;
    return this;
  }

  /**
   * 构建最终的审计查询过滤器
   * @returns 审计查询过滤器对象
   */
  build(): AuditQueryFilter {
    return { ...this.filter }; // 返回副本，避免外部修改内部状态
  }
}

/**
 * 创建审计过滤器构建器实例
 * @returns 审计过滤器构建器实例
 */
export function createAuditFilter(): AuditFilterBuilder {
  return new AuditFilterBuilder();
}
