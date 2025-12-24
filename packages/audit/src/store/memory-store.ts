import type {
  AuditEntry,
  AuditQueryFilter,
  AuditQueryOptions,
  AuditQueryResult,
  AuditStore,
} from '../types.js';

/**
 * In-memory implementation of AuditStore
 *
 * NOTE: This is for testing / demo only, not for production.
 */
export class InMemoryAuditStore implements AuditStore {
  private entries: AuditEntry[] = [];
  private idCounter = 0;

  private generateId(): string {
    return `audit_${++this.idCounter}_${Date.now()}`;
  }

  async log(entry: AuditEntry): Promise<void> {
    if (!entry.id) {
      entry.id = this.generateId();
    }
    if (!entry.timestamp) {
      entry.timestamp = new Date();
    }
    this.entries.push(entry);
  }

  async query(options: AuditQueryOptions = {}): Promise<AuditQueryResult> {
    const {
      filter = {},
      limit = 50,
      offset = 0,
      orderBy = 'timestamp',
      orderDirection = 'desc',
    } = options;

    // Filter
    let filtered = this.entries.filter(e => this.matchesFilter(e, filter));

    const total = filtered.length;

    // Sort
    filtered = filtered.sort((a, b) => {
      let cmp = 0;

      switch (orderBy) {
        case 'timestamp':
          cmp = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'tenant':
          cmp = a.tenantId.localeCompare(b.tenantId);
          break;
        case 'subject':
          cmp = (a.subjectId ?? '').localeCompare(b.subjectId ?? '');
          break;
      }

      return orderDirection === 'asc' ? cmp : -cmp;
    });

    // Pagination
    const entries = filtered.slice(offset, offset + limit);

    return {
      entries,
      total,
      limit,
      offset,
    };
  }

  async count(filter: AuditQueryFilter = {}): Promise<number> {
    return this.entries.filter(e => this.matchesFilter(e, filter)).length;
  }

  async clear(filter?: AuditQueryFilter): Promise<void> {
    if (!filter || Object.keys(filter).length === 0) {
      this.entries = [];
      return;
    }

    this.entries = this.entries.filter(e => !this.matchesFilter(e, filter));
  }

  private matchesFilter(entry: AuditEntry, filter: AuditQueryFilter): boolean {
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

    return true;
  }

  /**
   * Get all entries (for testing)
   */
  getAll(): AuditEntry[] {
    return [...this.entries];
  }
}

/**
 * Create in-memory audit store
 */
export function createInMemoryAuditStore(): InMemoryAuditStore {
  return new InMemoryAuditStore();
}
