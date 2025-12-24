import type { DataScopeDefinition, DataScopeStore, ScopeAssignment } from '../types.js';
import { validateScopeDefinition } from './definition.js';
import { PREDEFINED_SCOPES } from './predefined.js';

/**
 * 内存数据范围存储
 */
export class InMemoryDataScopeStore implements DataScopeStore {
  private scopes: Map<string, DataScopeDefinition> = new Map();
  private assignments: Map<string, ScopeAssignment> = new Map();
  private idCounter = 0;

  constructor() {
    for (const scope of Object.values(PREDEFINED_SCOPES)) {
      this.scopes.set(scope.id, scope);
    }
  }

  private generateId(): string {
    return `id_${++this.idCounter}_${Date.now()}`;
  }

  async createScope(scope: Omit<DataScopeDefinition, 'id'>): Promise<DataScopeDefinition> {
    const newScope: DataScopeDefinition = {
      ...scope,
      id: this.generateId(),
    };

    validateScopeDefinition(newScope);
    this.scopes.set(newScope.id, newScope);
    return newScope;
  }

  async updateScope(
    id: string,
    updates: Partial<DataScopeDefinition>
  ): Promise<DataScopeDefinition | null> {
    const existing = this.scopes.get(id);
    if (!existing) {
      return null;
    }

    const updated: DataScopeDefinition = {
      ...existing,
      ...updates,
      id,
    };

    validateScopeDefinition(updated);
    this.scopes.set(id, updated);
    return updated;
  }

  async deleteScope(id: string): Promise<boolean> {
    if (Object.values(PREDEFINED_SCOPES).some(s => s.id === id)) {
      throw new Error('Cannot delete predefined scope');
    }
    return this.scopes.delete(id);
  }

  async getScope(id: string): Promise<DataScopeDefinition | null> {
    return this.scopes.get(id) ?? null;
  }

  async listScopes(): Promise<DataScopeDefinition[]> {
    return Array.from(this.scopes.values());
  }

  async createAssignment(
    assignment: Omit<ScopeAssignment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ScopeAssignment> {
    const now = new Date();
    const newAssignment: ScopeAssignment = {
      ...assignment,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    this.assignments.set(newAssignment.id, newAssignment);
    return newAssignment;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    return this.assignments.delete(id);
  }

  async getAssignmentsForTarget(
    tenantId: string,
    targetType: ScopeAssignment['targetType'],
    targetId: string
  ): Promise<ScopeAssignment[]> {
    return Array.from(this.assignments.values()).filter(
      a =>
        a.tenantId === tenantId &&
        a.targetType === targetType &&
        a.targetId === targetId &&
        a.enabled
    );
  }

  async getAssignmentsForResource(
    tenantId: string,
    resourceName: string
  ): Promise<ScopeAssignment[]> {
    return Array.from(this.assignments.values()).filter(
      a =>
        a.tenantId === tenantId &&
        a.targetType === 'resource' &&
        a.targetId === resourceName &&
        a.enabled
    );
  }

  clear(): void {
    this.assignments.clear();
    // Re-register predefined scopes
    this.scopes.clear();
    for (const scope of Object.values(PREDEFINED_SCOPES)) {
      this.scopes.set(scope.id, scope);
    }
  }
}

/**
 * 范围注册表 - 管理范围定义和分配
 */
export class ScopeRegistry {
  private store: DataScopeStore;
  private cache: Map<string, { scope: DataScopeDefinition; expiresAt: number }> = new Map();
  private cacheTTL: number;

  constructor(store: DataScopeStore, options: { cacheTTL?: number } = {}) {
    this.store = store;
    this.cacheTTL = options.cacheTTL ?? 60000; // 1 minute
  }

  /**
   * 按ID获取范围
   */
  async getScope(id: string): Promise<DataScopeDefinition | null> {
    const cached = this.cache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.scope;
    }

    const scope = await this.store.getScope(id);

    if (scope) {
      this.cache.set(id, {
        scope,
        expiresAt: Date.now() + this.cacheTTL,
      });
    }

    return scope;
  }

  /**
   * 获取租户中某个主体的作用域
   */
  async getScopesForSubject(
    tenantId: string,
    subjectId: string,
    roles: string[] = []
  ): Promise<DataScopeDefinition[]> {
    const scopes: DataScopeDefinition[] = [];
    const seenIds = new Set<string>();

    // 获取直接分配的
    const subjectAssignments = await this.store.getAssignmentsForTarget(
      tenantId,
      'subject',
      subjectId
    );

    for (const assignment of subjectAssignments) {
      if (!seenIds.has(assignment.scopeId)) {
        const scope = await this.getScope(assignment.scopeId);
        if (scope) {
          scopes.push(scope);
          seenIds.add(assignment.scopeId);
        }
      }
    }

    // 获取基于角色的任务分配
    for (const role of roles) {
      const roleAssignments = await this.store.getAssignmentsForTarget(tenantId, 'role', role);

      for (const assignment of roleAssignments) {
        if (!seenIds.has(assignment.scopeId)) {
          const scope = await this.getScope(assignment.scopeId);
          if (scope) {
            scopes.push(scope);
            seenIds.add(assignment.scopeId);
          }
        }
      }
    }

    // Sort by priority
    return scopes.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * 获取资源范围
   */
  async getScopeForResource(
    tenantId: string,
    resourceName: string
  ): Promise<DataScopeDefinition | null> {
    const assignments = await this.store.getAssignmentsForResource(tenantId, resourceName);

    if (assignments.length === 0) {
      return null;
    }

    // Get highest priority assignment
    const sorted = assignments.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this.getScope(sorted[0].scopeId);
  }

  /**
   * 创建范围
   */
  async createScope(scope: Omit<DataScopeDefinition, 'id'>): Promise<DataScopeDefinition> {
    return this.store.createScope(scope);
  }

  /**
   * 将范围分配给目标
   */
  async assignScope(
    tenantId: string,
    scopeId: string,
    targetType: ScopeAssignment['targetType'],
    targetId: string,
    options: { permission?: string; priority?: number } = {}
  ): Promise<ScopeAssignment> {
    return this.store.createAssignment({
      tenantId,
      scopeId,
      targetType,
      targetId,
      permission: options.permission,
      priority: options.priority ?? 0,
      enabled: true,
    });
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * 创建范围注册表
 */
export function createScopeRegistry(
  store?: DataScopeStore,
  options?: { cacheTTL?: number }
): ScopeRegistry {
  return new ScopeRegistry(store ?? new InMemoryDataScopeStore(), options);
}
