import type {
  AuditEntry,
  AuditQueryFilter,
  AuditQueryOptions,
  AuditQueryResult,
  AuditStore,
} from '../types.js';

/**
 * 内存审计存储实现
 *
 * 注意：此实现仅用于测试/演示，不适用于生产环境。
 */
export class InMemoryAuditStore implements AuditStore {
  private entries: AuditEntry[] = []; // 存储所有审计条目的数组
  private idCounter = 0; // 用于生成唯一ID的计数器

  /**
   * 生成唯一的审计ID
   * @returns 唯一ID字符串
   */
  private generateId(): string {
    return `audit_${++this.idCounter}_${Date.now()}`;
  }

  /**
   * 记录审计条目
   * @param entry 审计条目
   */
  async log(entry: AuditEntry): Promise<void> {
    // 如果没有ID，自动生成
    if (!entry.id) {
      entry.id = this.generateId();
    }
    // 如果没有时间戳，自动添加当前时间
    if (!entry.timestamp) {
      entry.timestamp = new Date();
    }
    // 将条目添加到内存数组中
    this.entries.push(entry);
  }

  /**
   * 查询审计记录
   * @param options 查询选项，包含过滤、分页和排序
   * @returns 查询结果，包含审计条目列表和分页信息
   */
  async query(options: AuditQueryOptions = {}): Promise<AuditQueryResult> {
    const {
      filter = {}, // 过滤条件，默认为空
      limit = 50, // 每页数量，默认50条
      offset = 0, // 偏移量，默认从0开始
      orderBy = 'timestamp', // 排序字段，默认按时间戳
      orderDirection = 'desc', // 排序方向，默认降序
    } = options;

    // 1. 过滤：根据条件筛选符合要求的审计条目
    let filtered = this.entries.filter(e => this.matchesFilter(e, filter));

    // 获取过滤后的总条数
    const total = filtered.length;

    // 2. 排序：根据指定字段和方向排序
    filtered = filtered.sort((a, b) => {
      let cmp = 0;

      switch (orderBy) {
        case 'timestamp':
          // 按时间戳比较
          cmp = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'tenant':
          // 按租户ID比较
          cmp = a.tenantId.localeCompare(b.tenantId);
          break;
        case 'subject':
          // 按主体ID比较
          cmp = (a.subjectId ?? '').localeCompare(b.subjectId ?? '');
          break;
      }

      // 根据排序方向返回比较结果
      return orderDirection === 'asc' ? cmp : -cmp;
    });

    // 3. 分页：获取指定偏移量和数量的条目
    const entries = filtered.slice(offset, offset + limit);

    // 返回查询结果
    return {
      entries,
      total,
      limit,
      offset,
    };
  }

  /**
   * 统计符合条件的审计记录数量
   * @param filter 过滤条件
   * @returns 记录数量
   */
  async count(filter: AuditQueryFilter = {}): Promise<number> {
    return this.entries.filter(e => this.matchesFilter(e, filter)).length;
  }

  /**
   * 清除审计记录
   * @param filter 过滤条件，为空则清除所有记录
   */
  async clear(filter?: AuditQueryFilter): Promise<void> {
    // 如果没有过滤条件或条件为空，清除所有记录
    if (!filter || Object.keys(filter).length === 0) {
      this.entries = [];
      return;
    }

    // 只保留不符合过滤条件的记录，即清除符合条件的记录
    this.entries = this.entries.filter(e => !this.matchesFilter(e, filter));
  }

  /**
   * 检查审计条目是否匹配过滤条件
   * @param entry 审计条目
   * @param filter 过滤条件
   * @returns 是否匹配
   */
  private matchesFilter(entry: AuditEntry, filter: AuditQueryFilter): boolean {
    // 逐个检查过滤条件
    if (filter.tenantId && entry.tenantId !== filter.tenantId) return false;
    if (filter.subjectId && entry.subjectId !== filter.subjectId) return false;
    if (filter.resource && entry.resource !== filter.resource) return false;
    if (filter.resourceId && entry.resourceId !== filter.resourceId) return false;
    if (filter.category && entry.category !== filter.category) return false;
    if (filter.decision && entry.decision !== filter.decision) return false;
    if (filter.action && entry.action !== filter.action) return false;
    if (filter.permission && entry.permission !== filter.permission) return false;
    if (filter.from && entry.timestamp < filter.from) return false;
    if (filter.to && entry.timestamp > filter.to) return false;

    // 所有条件都匹配
    return true;
  }

  /**
   * 获取所有审计条目（仅用于测试）
   * @returns 所有审计条目列表
   */
  getAll(): AuditEntry[] {
    return [...this.entries]; // 返回副本，避免直接修改内部数组
  }
}

/**
 * 创建内存审计存储实例
 * @returns 内存审计存储实例
 */
export function createInMemoryAuditStore(): InMemoryAuditStore {
  return new InMemoryAuditStore();
}
