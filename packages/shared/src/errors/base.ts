/**
 * MTPC 的基础错误类
 * 所有 MTPC 相关错误都继承自此类
 */
export class MTPCError extends Error {
  /** 错误代码，用于标识具体错误类型 */
  public readonly code: string;
  /** 错误详情，包含额外的错误信息 */
  public readonly details?: Record<string, unknown>;

  /**
   * 创建 MTPC 错误实例
   * @param message 错误消息
   * @param code 错误代码
   * @param details 错误详情
   */
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'MTPCError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * 将错误转换为 JSON 格式
   * 用于错误序列化和日志记录
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
