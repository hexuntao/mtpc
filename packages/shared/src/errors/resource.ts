import { MTPCError } from './base.js';

/**
 * 资源未找到错误
 * 当请求的资源不存在时抛出
 */
export class ResourceNotFoundError extends MTPCError {
  /**
   * 创建资源未找到错误实例
   * @param resourceName 未找到的资源名称
   */
  constructor(resourceName: string) {
    super(`资源未找到: ${resourceName}`, 'RESOURCE_NOT_FOUND', { resourceName });
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * 资源已存在错误
 * 当尝试创建已存在的资源时抛出
 */
export class ResourceAlreadyExistsError extends MTPCError {
  /**
   * 创建资源已存在错误实例
   * @param resourceName 已存在的资源名称
   */
  constructor(resourceName: string) {
    super(`资源已存在: ${resourceName}`, 'RESOURCE_ALREADY_EXISTS', { resourceName });
    this.name = 'ResourceAlreadyExistsError';
  }
}

/**
 * 无效的资源定义错误
 * 当资源定义不符合规范时抛出
 */
export class InvalidResourceDefinitionError extends MTPCError {
  /**
   * 创建无效资源定义错误实例
   * @param resourceName 资源名称
   * @param reason 错误原因
   */
  constructor(resourceName: string, reason: string) {
    super(`资源 "${resourceName}" 的定义无效: ${reason}`, 'INVALID_RESOURCE_DEFINITION', {
      resourceName,
      reason,
    });
    this.name = 'InvalidResourceDefinitionError';
  }
}

/**
 * 资源操作不允许错误
 * 当尝试对资源执行不允许的操作时抛出
 */
export class ResourceOperationNotAllowedError extends MTPCError {
  /**
   * 创建资源操作不允许错误实例
   * @param resourceName 资源名称
   * @param operation 不允许的操作名称
   */
  constructor(resourceName: string, operation: string) {
    super(
      `不允许对资源 "${resourceName}" 执行操作 "${operation}"`,
      'RESOURCE_OPERATION_NOT_ALLOWED',
      { resourceName, operation }
    );
    this.name = 'ResourceOperationNotAllowedError';
  }
}
