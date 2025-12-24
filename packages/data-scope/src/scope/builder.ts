import type {
  DataScopeDefinition,
  ScopeCondition,
  ScopeConditionOperator,
  ScopeType,
  ScopeValueResolver,
} from '../types.js';
import { createScopeDefinition } from './definition.js';

/**
 * Scope builder for fluent API
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
   * Set scope ID
   */
  id(id: string): this {
    this.definition.id = id;
    return this;
  }

  /**
   * Set description
   */
  description(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * Set scope type
   */
  type(type: ScopeType): this {
    this.definition.type = type;
    return this;
  }

  /**
   * Set as "all" scope (no restrictions)
   */
  all(): this {
    this.definition.type = 'all';
    this.definition.conditions = [];
    return this;
  }

  /**
   * Set as "tenant" scope
   */
  tenant(): this {
    this.definition.type = 'tenant';
    return this;
  }

  /**
   * Set as "self" scope
   */
  self(ownerField: string = 'createdBy'): this {
    this.definition.type = 'self';
    this.definition.conditions = [
      {
        field: ownerField,
        operator: 'eq',
        value: ctx => ctx.subject.id,
        contextField: 'subject.id',
      },
    ];
    return this;
  }

  /**
   * Set as "department" scope
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
        value: ctx => {
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
   * Set as "team" scope
   */
  team(resourceField: string = 'teamId', contextField: string = 'subject.metadata.teamId'): this {
    this.definition.type = 'team';
    this.definition.conditions = [
      {
        field: resourceField,
        operator: 'eq',
        value: ctx => {
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
   * Add custom condition
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
   * Add equality condition
   */
  whereEquals(field: string, value: unknown | ScopeValueResolver): this {
    return this.where(field, 'eq', value);
  }

  /**
   * Add field equals context field condition
   */
  whereFieldEquals(resourceField: string, contextField: string): this {
    this.definition.type = 'custom';
    this.definition.conditions.push({
      field: resourceField,
      operator: 'eq',
      value: ctx => {
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
   * Add "in" condition
   */
  whereIn(field: string, values: unknown[] | ScopeValueResolver): this {
    return this.where(field, 'in', values);
  }

  /**
   * Add "not in" condition
   */
  whereNotIn(field: string, values: unknown[] | ScopeValueResolver): this {
    return this.where(field, 'notIn', values);
  }

  /**
   * Add hierarchy condition (e.g., for org structure)
   */
  whereInHierarchy(field: string, rootResolver: ScopeValueResolver): this {
    return this.where(field, 'hierarchy', rootResolver);
  }

  /**
   * Set priority
   */
  priority(priority: number): this {
    this.definition.priority = priority;
    return this;
  }

  /**
   * Set as non-combinable
   */
  exclusive(): this {
    this.definition.combinable = false;
    return this;
  }

  /**
   * Set metadata
   */
  metadata(metadata: Record<string, unknown>): this {
    this.definition.metadata = { ...this.definition.metadata, ...metadata };
    return this;
  }

  /**
   * Build the scope definition
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
 * Create a scope builder
 */
export function scope(name: string): ScopeBuilder {
  return new ScopeBuilder(name);
}

/**
 * Quick create common scopes
 */
export const createScope = {
  /**
   * Create "all" scope
   */
  all(name: string = 'all'): DataScopeDefinition {
    return scope(name).all().build();
  },

  /**
   * Create "self" scope
   */
  self(name: string = 'self', ownerField?: string): DataScopeDefinition {
    return scope(name).self(ownerField).build();
  },

  /**
   * Create "department" scope
   */
  department(
    name: string = 'department',
    resourceField?: string,
    contextField?: string
  ): DataScopeDefinition {
    return scope(name).department(resourceField, contextField).build();
  },

  /**
   * Create "team" scope
   */
  team(name: string = 'team', resourceField?: string, contextField?: string): DataScopeDefinition {
    return scope(name).team(resourceField, contextField).build();
  },

  /**
   * Create custom scope with single condition
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
