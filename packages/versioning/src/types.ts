// import type { MTPCContext, ResourceHooks } from '@mtpc/core';

/**
 * 版本控制配置
 */
export interface VersioningConfig {
  /** 资源名称 */
  resourceName: string; 
  /**
   * 资源 schema 中的版本字段名，例如 "version"
   */
  versionField?: string;
}

/**
 * 版本冲突错误（用于乐观锁机制）
 *
 * 当并发更新同一资源时，如果版本号不匹配，会抛出此错误
 */
export class VersionConflictError extends Error {
  /** 期望的版本号 */
  readonly expected: number | undefined; 
  /** 实际的版本号 */
  readonly actual: number | undefined; 

  /**
   * 构造函数
   * @param message 错误消息
   * @param expected 期望的版本号
   * @param actual 实际的版本号
   */
  constructor(message: string, expected?: number, actual?: number) {
    super(message);
    this.name = 'VersionConflictError';
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * 版本控制插件的内部状态
 */
export interface VersioningPluginState {
  /**
   * 存储所有资源的版本控制配置
   * 键为资源名称，值为对应的版本控制配置
   */
  configs: Map<string, VersioningConfig>;
}
