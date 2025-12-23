import type { BulkExplainResult, PermissionExplanation } from './types.js';

/**
 * Explanation entry with metadata
 */
interface ExplanationEntry {
  explanation: PermissionExplanation;
  collectedAt: Date;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Collector options
 */
interface CollectorOptions {
  maxEntries?: number;
  ttl?: number;
  onCollect?: (entry: ExplanationEntry) => void;
}

/**
 * Explanation collector for debugging and auditing
 */
export class ExplanationCollector {
  private entries: ExplanationEntry[] = [];
  private options: CollectorOptions;

  constructor(options: CollectorOptions = {}) {
    this.options = {
      maxEntries: options.maxEntries ?? 1000,
      ttl: options.ttl ?? 3600000, // 1 hour
      ...options,
    };
  }

  /**
   * Collect explanation
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

    // Enforce max entries
    while (this.entries.length > (this.options.maxEntries ?? 1000)) {
      this.entries.shift();
    }

    // Callback
    this.options.onCollect?.(entry);
  }

  /**
   * Collect bulk result
   */
  collectBulk(
    result: BulkExplainResult,
    metadata?: { requestId?: string; [key: string]: unknown }
  ): void {
    for (const explanation of result.explanations) {
      this.collect(explanation, metadata);
    }
  }

  /**
   * Get recent explanations
   */
  getRecent(count: number = 10): ExplanationEntry[] {
    return this.entries.slice(-count).reverse();
  }

  /**
   * Get explanations by tenant
   */
  getByTenant(tenantId: string): ExplanationEntry[] {
    return this.entries.filter(e => e.explanation.context.tenant.id === tenantId);
  }

  /**
   * Get explanations by subject
   */
  getBySubject(subjectId: string): ExplanationEntry[] {
    return this.entries.filter(e => e.explanation.context.subject.id === subjectId);
  }

  /**
   * Get explanations by permission
   */
  getByPermission(permission: string): ExplanationEntry[] {
    return this.entries.filter(e => e.explanation.permission === permission);
  }

  /**
   * Get explanations by decision
   */
  getByDecision(decision: 'allow' | 'deny' | 'not_applicable'): ExplanationEntry[] {
    return this.entries.filter(e => e.explanation.decision === decision);
  }

  /**
   * Get denied explanations
   */
  getDenied(): ExplanationEntry[] {
    return this.getByDecision('deny');
  }

  /**
   * Get statistics
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

      // Count by decision
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

      // Sum duration
      totalDuration += explanation.duration;

      // Count by resource
      const resource = explanation.resource;
      stats.byResource[resource] = (stats.byResource[resource] ?? 0) + 1;

      // Count by subject
      const subject = explanation.context.subject.id;
      stats.bySubject[subject] = (stats.bySubject[subject] ?? 0) + 1;
    }

    stats.averageDuration = stats.total > 0 ? totalDuration / stats.total : 0;

    return stats;
  }

  /**
   * Clear old entries
   */
  cleanup(): number {
    const cutoff = Date.now() - (this.options.ttl ?? 3600000);
    const before = this.entries.length;

    this.entries = this.entries.filter(e => e.collectedAt.getTime() > cutoff);

    return before - this.entries.length;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Export entries
   */
  export(): ExplanationEntry[] {
    return [...this.entries];
  }

  /**
   * Get entry count
   */
  get size(): number {
    return this.entries.length;
  }
}

/**
 * Create explanation collector
 */
export function createCollector(options?: CollectorOptions): ExplanationCollector {
  return new ExplanationCollector(options);
}
