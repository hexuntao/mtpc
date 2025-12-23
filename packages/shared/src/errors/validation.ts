import type { ZodError } from 'zod';
import { MTPCError } from './base.js';

/**
 * 验证错误
 * 当数据验证失败时抛出，用于处理各种验证场景
 */
export class ValidationError extends MTPCError {
  /**
   * 验证错误详情列表
   * 包含每个验证失败的路径和错误消息
   */
  public readonly issues: Array<{
    /** 错误路径，指示错误发生的位置 */
    path: (string | number)[];
    /** 错误消息，描述验证失败的原因 */
    message: string;
  }>;

  /**
   * 创建验证错误实例
   * @param zodError Zod 验证错误对象
   */
  constructor(zodError: ZodError) {
    const issues = zodError.issues.map(issue => ({
      path: issue.path,
      message: issue.message,
    }));

    super('验证失败', 'VALIDATION_ERROR', { issues });
    this.name = 'ValidationError';
    this.issues = issues;
  }

  /**
   * 从错误消息创建验证错误实例
   * @param message 错误消息
   * @param path 错误路径
   * @returns 验证错误实例
   */
  static fromMessage(message: string, path: string[] = []) {
    const error = new MTPCError(message, 'VALIDATION_ERROR', { path });
    error.name = 'ValidationError';
    return error;
  }
}
