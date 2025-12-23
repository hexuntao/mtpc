import { MTPCError } from './base.js';

/**
 * 权限拒绝错误
 * 当用户尝试访问没有权限的资源或执行没有权限的操作时抛出
 */
export class PermissionDeniedError extends MTPCError {
  /**
   * 创建权限拒绝错误实例
   * @param permission 被拒绝的权限代码
   * @param details 额外的错误详情
   */
  constructor(permission: string, details?: Record<string, unknown>) {
    super(`权限被拒绝: ${permission}`, 'PERMISSION_DENIED', { permission, ...details });
    this.name = 'PermissionDeniedError';
  }
}

/**
 * 权限未找到错误
 * 当请求的权限不存在时抛出
 */
export class PermissionNotFoundError extends MTPCError {
  /**
   * 创建权限未找到错误实例
   * @param permission 未找到的权限代码
   */
  constructor(permission: string) {
    super(`权限未找到: ${permission}`, 'PERMISSION_NOT_FOUND', { permission });
    this.name = 'PermissionNotFoundError';
  }
}

/**
 * 无效的权限代码错误
 * 当权限代码格式不正确或包含无效字符时抛出
 */
export class InvalidPermissionCodeError extends MTPCError {
  /**
   * 创建无效权限代码错误实例
   * @param code 无效的权限代码
   * @param reason 错误原因
   */
  constructor(code: string, reason: string) {
    super(`无效的权限代码 "${code}": ${reason}`, 'INVALID_PERMISSION_CODE', {
      code,
      reason,
    });
    this.name = 'InvalidPermissionCodeError';
  }
}
