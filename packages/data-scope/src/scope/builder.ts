import type { MTPCContext } from '@mtpc/core';
import type {
  DataScopeDefinition,
  ScopeCondition,
  ScopeConditionOperator,
  ScopeType,
  ScopeValueResolver,
} from '../types.js';
import { createScopeDefinition } from './definition.js';

/**
 * 范围构建器，提供流式 API
 */
export class ScopeBuilder {
  private definition: Partial<DataScopeDefinition> & { conditions: ScopeCondition[] };

  constructor(name: string) {
    this.definition = {
      name,
      type: 'custom',
      conditions: [],
      priority: 0,
      combinable: true,
    };
  }

  /**
   * 设置范围 ID
   */
  id(id: string): this {
    this.definition.id = id;
    return this;
  }

  /**
   * 设置描述
   */
  description(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * 设置范围类型
   */
  type(type: ScopeType): this {
    this.definition.type = type;
    return this;
  }

  /**
   * 设置为 "all" 范围（无限制）
   */
  all(): this {
    this.definition.type = 'all';
    this.definition.conditions = [];
    return this;
  }

  /**
   * 设置为 "tenant" 范围
   */
  tenant(): this {
    this.definition.type = 'tenant';
    return this;
  }

  /**
   * 设置为 "self" 范围
   */
  self(ownerField: string = 'createdBy'): this {
    this.definition.type = 'self';
    this.definition.conditions = [
      {
        field: ownerField,
        operator: 'eq',
        value: (ctx: MTPCContext) => ctx.subject.id,
        contextField: 'subject.id',
      },
    ];
    return this;
  }

  /**
   * 设置为 "department" 范围
   */
  department(
    resourceField: string = 'departmentId',
    contextField: string = 'subject.metadata.departmentId'
  ): this {
    this.definition.type = 'department';
    this.definition.conditions = [
      {
        field: resourceField,
        operator: 'eq',
        value: (ctx: MTPCContext) => {
          const parts = contextField.split('.');
          let value: unknown = ctx;
          for (const part of parts) {
            value = (value as Record<string, unknown>)?.[part];
          }
          return value;
        },
        contextField,
      },
    ];
    return this;
  }

  /**
   * 设置为 "team" 范围
   */
  team(resourceField: string = 'teamId', contextField: string = 'subject.metadata.teamId'): this {
    this.definition.type = 'team';
    this.definition.conditions = [
      {
        field: resourceField,
        operator: 'eq',
        value: (ctx: MTPCContext) => {
          const parts = contextField.split('.');
          let value: unknown = ctx;
          for (const part of parts) {
            value = (value as Record<string, unknown>)?.[part];
          }
          return value;
        },
        contextField,
      },
    ];
    return this;
  }

  /**
   * 添加自定义条件
   */
  where(
    field: string,
    operator: ScopeConditionOperator,
    value: unknown | ScopeValueResolver
  ): this {
    this.definition.type = 'custom';
    this.definition.conditions.push({
      field,
      operator,
      value,
    });
    return this;
  }

  /**
   * 添加相等条件
   */
  whereEquals(field: string, value: unknown | ScopeValueResolver): this {
    return this.where(field, 'eq', value);
  }

  /**
   * 添加字段等于上下文字段的条件
   */
  whereFieldEquals(resourceField: string, contextField: string): this {
    this.definition.type = 'custom';
    this.definition.conditions.push({
      field: resourceField,
      operator: 'eq',
      value: (ctx: MTPCContext) => {
        const parts = contextField.split('.');
        let value: unknown = ctx;
        for (const part of parts) {
          value = (value as Record<string, unknown>)?.[part];
        }
        return value;
      },
      contextField,
    });
    return this;
  }

  /**
   * 添加 "in" 条件
   */
  whereIn(field: string, values: unknown[] | ScopeValueResolver): this {
    return this.where(field, 'in', values);
  }

  /**
   * 添加 "not in" 条件
   */
  whereNotIn(field: string, values: unknown[] | ScopeValueResolver): this {
    return this.where(field, 'notIn', values);
  }

  /**
   * 添加层级条件（例如：用于组织结构）
   */
  whereInHierarchy(field: string, rootResolver: ScopeValueResolver): this {
    return this.where(field, 'hierarchy', rootResolver);
  }

  /**
   * 设置优先级
   */
  priority(priority: number): this {
    this.definition.priority = priority;
    return this;
  }

  /**
   * 设置为不可组合
   */
  exclusive(): this {
    this.definition.combinable = false;
    return this;
  }

  /**
   * 设置元数据
   */
  metadata(metadata: Record<string, unknown>): this {
    this.definition.metadata = { ...this.definition.metadata, ...metadata };
    return this;
  }

  /**
   * 构建范围定义
   */
  build(): DataScopeDefinition {
    return createScopeDefinition({
      id: this.definition.id,
      name: this.definition.name!,
      description: this.definition.description,
      type: this.definition.type!,
      conditions: this.definition.conditions,
      priority: this.definition.priority,
      combinable: this.definition.combinable,
      metadata: this.definition.metadata,
    });
  }
}

/**
 * 创建范围构建器
 */
export function scope(name: string): ScopeBuilder {
  return new ScopeBuilder(name);
}

/**
 * 快速创建通用范围
 */
export const createScope = {
  /**
   * 创建 "all" 范围
   */
  all(name: string = 'all'): DataScopeDefinition {
    return scope(name).all().build();
  },

  /**
   * 创建 "self" 范围
   */
  self(name: string = 'self', ownerField?: string): DataScopeDefinition {
    return scope(name).self(ownerField).build();
  },

  /**
   * 创建 "department" 范围
   */
  department(
    name: string = 'department',
    resourceField?: string,
    contextField?: string
  ): DataScopeDefinition {
    return scope(name).department(resourceField, contextField).build();
  },

  /**
   * 创建 "team" 范围
   */
  team(name: string = 'team', resourceField?: string, contextField?: string): DataScopeDefinition {
    return scope(name).team(resourceField, contextField).build();
  },

  /**
   * 创建带有单个条件的自定义范围
   */
  custom(
    name: string,
    field: string,
    operator: ScopeConditionOperator,
    value: unknown | ScopeValueResolver
  ): DataScopeDefinition {
    return scope(name).where(field, operator, value).build();
  },
};
