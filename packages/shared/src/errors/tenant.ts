import { MTPCError } from './base.js';

/**
 * 租户未找到错误
 * 当请求的租户不存在时抛出
 */
export class TenantNotFoundError extends MTPCError {
  /**
   * 创建租户未找到错误实例
   * @param tenantId 未找到的租户 ID
   */
  constructor(tenantId: string) {
    super(`租户未找到: ${tenantId}`, 'TENANT_NOT_FOUND', { tenantId });
    this.name = 'TenantNotFoundError';
  }
}

/**
 * 缺少租户上下文错误
 * 当操作需要租户上下文但未提供时抛出
 */
export class MissingTenantContextError extends MTPCError {
  /**
   * 创建缺少租户上下文错误实例
   */
  constructor() {
    super('租户上下文是必需的，但未提供', 'MISSING_TENANT_CONTEXT');
    this.name = 'MissingTenantContextError';
  }
}

/**
 * 无效的租户错误
 * 当租户信息无效时抛出
 */
export class InvalidTenantError extends MTPCError {
  /**
   * 创建无效租户错误实例
   * @param reason 错误原因
   */
  constructor(reason: string) {
    super(`无效的租户: ${reason}`, 'INVALID_TENANT', { reason });
    this.name = 'InvalidTenantError';
  }
}
