import type { DataScopeDefinition, ScopeCondition, ScopeType } from '../types.js';

let scopeIdCounter = 0;

/**
 * 生成范围 ID
 */
function generateScopeId(): string {
  return `scope_${++scopeIdCounter}_${Date.now()}`;
}

/**
 * 创建数据范围定义
 */
export function createScopeDefinition(
  options: Omit<DataScopeDefinition, 'id'> & { id?: string }
): DataScopeDefinition {
  return {
    id: options.id ?? generateScopeId(),
    name: options.name,
    description: options.description,
    type: options.type,
    conditions: options.conditions ?? [],
    priority: options.priority ?? 0,
    combinable: options.combinable ?? true,
    metadata: options.metadata,
  };
}

/**
 * 验证范围定义
 */
export function validateScopeDefinition(scope: DataScopeDefinition): void {
  if (!scope.id || typeof scope.id !== 'string') {
    throw new Error('Scope must have a valid ID');
  }

  if (!scope.name || typeof scope.name !== 'string') {
    throw new Error('Scope must have a valid name');
  }

  const validTypes: ScopeType[] = [
    'all',
    'tenant',
    'department',
    'team',
    'self',
    'subordinates',
    'custom',
  ];
  if (!validTypes.includes(scope.type)) {
    throw new Error(`Invalid scope type: ${scope.type}`);
  }

  if (scope.type === 'custom' && (!scope.conditions || scope.conditions.length === 0)) {
    throw new Error('Custom scope must have at least one condition');
  }

  // 验证条件
  if (scope.conditions) {
    for (const condition of scope.conditions) {
      validateScopeCondition(condition);
    }
  }
}

/**
 * 验证范围条件
 */
export function validateScopeCondition(condition: ScopeCondition): void {
  if (!condition.field || typeof condition.field !== 'string') {
    throw new Error('Condition must have a valid field');
  }

  const validOperators = ['eq', 'neq', 'in', 'notIn', 'contains', 'hierarchy'];
  if (!validOperators.includes(condition.operator)) {
    throw new Error(`Invalid condition operator: ${condition.operator}`);
  }
}

/**
 * 克隆范围定义
 */
export function cloneScopeDefinition(
  scope: DataScopeDefinition,
  overrides?: Partial<DataScopeDefinition>
): DataScopeDefinition {
  return {
    ...scope,
    id: generateScopeId(),
    conditions: scope.conditions ? [...scope.conditions] : undefined,
    metadata: scope.metadata ? { ...scope.metadata } : undefined,
    ...overrides,
  };
}

/**
 * 合并范围条件
 */
export function mergeScopeConditions(
  ...conditionArrays: (ScopeCondition[] | undefined)[]
): ScopeCondition[] {
  const merged: ScopeCondition[] = [];

  for (const conditions of conditionArrays) {
    if (conditions) {
      merged.push(...conditions);
    }
  }

  return merged;
}
