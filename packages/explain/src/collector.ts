import type { BulkExplainResult, PermissionExplanation } from './types.js';

/**
 * 带有元数据的解释条目
 */
interface ExplanationEntry {
  /** 权限解释 */
  explanation: PermissionExplanation;
  /** 收集时间 */
  collectedAt: Date;
  /** 请求ID（可选） */
  requestId?: string;
  /** 附加元数据（可选） */
  metadata?: Record<string, unknown>;
}

/**
 * 收集器选项
 */
interface CollectorOptions {
  /** 最大条目数，超过后会自动删除最旧的条目 */
  maxEntries?: number;
  /** 条目生存时间（毫秒），超过后会自动清理 */
  ttl?: number;
  /** 收集条目时的回调函数（可选） */
  onCollect?: (entry: ExplanationEntry) => void;
}

/**
 * 解释收集器，用于调试和审计
 * 提供了收集、查询、统计和管理权限解释结果的功能
 */
export class ExplanationCollector {
  /** 收集的解释条目列表 */
  private entries: ExplanationEntry[] = [];
  /** 收集器选项 */
  private options: CollectorOptions;

  /**
   * 创建解释收集器实例
   * @param options 收集器选项
   */
  constructor(options: CollectorOptions = {}) {
    // 验证 maxEntries 参数
    const maxEntries = options.maxEntries ?? 1000;
    if (typeof maxEntries !== 'number' || maxEntries <= 0) {
      throw new Error('maxEntries must be a positive number');
    }

    // 验证 ttl 参数
    const ttl = options.ttl ?? 3600000;
    if (typeof ttl !== 'number' || ttl <= 0) {
      throw new Error('ttl must be a positive number');
    }

    this.options = {
      maxEntries,
      ttl,
      onCollect: options.onCollect,
    };
  }

  /**
   * 收集单个权限解释
   * @param explanation 权限解释结果
   * @param metadata 附加元数据，包含requestId等信息
   */
  collect(
    explanation: PermissionExplanation,
    metadata?: { requestId?: string; [key: string]: unknown }
  ): void {
    const entry: ExplanationEntry = {
      explanation,
      collectedAt: new Date(),
      requestId: metadata?.requestId,
      metadata,
    };

    this.entries.push(entry);

    // 确保条目数不超过最大值，超过则删除最旧的条目
    while (this.entries.length > (this.options.maxEntries ?? 1000)) {
      this.entries.shift();
    }

    // 调用收集回调（如果设置了）
    this.options.onCollect?.(entry);
  }

  /**
   * 收集批量权限解释结果
   * @param result 批量解释结果
   * @param metadata 附加元数据
   */
  collectBulk(
    result: BulkExplainResult,
    metadata?: { requestId?: string; [key: string]: unknown }
  ): void {
    // 遍历批量结果，逐个收集
    for (const explanation of result.explanations) {
      this.collect(explanation, metadata);
    }
  }

  /**
   * 获取最近的解释条目
   * @param count 要获取的条目数量，默认10
   * @returns 最近的解释条目列表，按时间倒序排列
   */
  getRecent(count: number = 10): ExplanationEntry[] {
    return this.entries.slice(-count).reverse();
  }

  /**
   * 按租户ID获取解释条目
   * @param tenantId 租户ID
   * @returns 匹配的解释条目列表
   */
  getByTenant(tenantId: string): ExplanationEntry[] {
    return this.entries.filter(e => e.explanation.context.tenant.id === tenantId);
  }

  /**
   * 按主体ID获取解释条目
   * @param subjectId 主体ID
   * @returns 匹配的解释条目列表
   */
  getBySubject(subjectId: string): ExplanationEntry[] {
    return this.entries.filter(e => e.explanation.context.subject.id === subjectId);
  }

  /**
   * 按权限代码获取解释条目
   * @param permission 权限代码
   * @returns 匹配的解释条目列表
   */
  getByPermission(permission: string): ExplanationEntry[] {
    return this.entries.filter(e => e.explanation.permission === permission);
  }

  /**
   * 按决策类型获取解释条目
   * @param decision 决策类型
   * @returns 匹配的解释条目列表
   */
  getByDecision(decision: 'allow' | 'deny' | 'not_applicable'): ExplanationEntry[] {
    return this.entries.filter(e => e.explanation.decision === decision);
  }

  /**
   * 获取所有被拒绝的解释条目
   * @returns 被拒绝的解释条目列表
   */
  getDenied(): ExplanationEntry[] {
    return this.getByDecision('deny');
  }

  /**
   * 获取统计信息
   * @returns 包含各种统计数据的对象
   */
  getStats(): {
    total: number;
    allowed: number;
    denied: number;
    notApplicable: number;
    averageDuration: number;
    byResource: Record<string, number>;
    bySubject: Record<string, number>;
  } {
    const stats = {
      total: this.entries.length,
      allowed: 0,
      denied: 0,
      notApplicable: 0,
      averageDuration: 0,
      byResource: {} as Record<string, number>,
      bySubject: {} as Record<string, number>,
    };

    let totalDuration = 0;

    for (const entry of this.entries) {
      const { explanation } = entry;

      // 按决策类型统计
      switch (explanation.decision) {
        case 'allow':
          stats.allowed++;
          break;
        case 'deny':
          stats.denied++;
          break;
        case 'not_applicable':
          stats.notApplicable++;
          break;
      }

      // 累计耗时
      totalDuration += explanation.duration;

      // 按资源统计
      const resource = explanation.resource;
      stats.byResource[resource] = (stats.byResource[resource] ?? 0) + 1;

      // 按主体统计
      const subject = explanation.context.subject.id;
      stats.bySubject[subject] = (stats.bySubject[subject] ?? 0) + 1;
    }

    // 计算平均耗时
    stats.averageDuration = stats.total > 0 ? totalDuration / stats.total : 0;

    return stats;
  }

  /**
   * 清理过期的条目
   * @returns 清理的条目数量
   */
  cleanup(): number {
    const cutoff = Date.now() - (this.options.ttl ?? 3600000);
    const before = this.entries.length;

    // 过滤掉超过生存时间的条目
    this.entries = this.entries.filter(e => e.collectedAt.getTime() > cutoff);

    return before - this.entries.length;
  }

  /**
   * 清空所有条目
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * 导出所有条目
   * @returns 所有收集的解释条目副本
   */
  export(): ExplanationEntry[] {
    return [...this.entries];
  }

  /**
   * 获取当前条目数量
   */
  get size(): number {
    return this.entries.length;
  }
}

/**
 * 创建解释收集器实例
 * @param options 收集器选项
 * @returns 解释收集器实例
 */
export function createCollector(options?: CollectorOptions): ExplanationCollector {
  return new ExplanationCollector(options);
}
