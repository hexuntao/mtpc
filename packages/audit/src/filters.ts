import type { AuditEntry, AuditQueryFilter } from './types.js';

/**
 * Build a filter object in a fluent way
 */
export class AuditFilterBuilder {
  private filter: AuditQueryFilter = {};

  tenant(tenantId: string): this {
    this.filter.tenantId = tenantId;
    return this;
  }

  subject(subjectId: string): this {
    this.filter.subjectId = subjectId;
    return this;
  }

  resource(resource: string): this {
    this.filter.resource = resource;
    return this;
  }

  resourceId(resourceId: string): this {
    this.filter.resourceId = resourceId;
    return this;
  }

  category(category: AuditEntry['category']): this {
    this.filter.category = category;
    return this;
  }

  decision(decision: AuditEntry['decision']): this {
    this.filter.decision = decision;
    return this;
  }

  action(action: string): this {
    this.filter.action = action;
    return this;
  }

  permission(permission: string): this {
    this.filter.permission = permission;
    return this;
  }

  from(date: Date): this {
    this.filter.from = date;
    return this;
  }

  to(date: Date): this {
    this.filter.to = date;
    return this;
  }

  build(): AuditQueryFilter {
    return { ...this.filter };
  }
}

/**
 * Create audit filter builder
 */
export function createAuditFilter(): AuditFilterBuilder {
  return new AuditFilterBuilder();
}
