import { z } from 'zod';
import type {
  AnyZodSchema,
  InferSchema,
  PermissionDefinition,
  ResourceDefinition,
  ResourceDefinitionInput,
  ResourceFeatures,
  ResourceHooks,
  ResourceMetadata,
  ResourceRelationDefinition,
} from '../types/index.js';
import { defineResource } from './define.js';

/**
 * Resource builder for fluent API
 */
export class ResourceBuilder<
  TName extends string = string,
  TSchema extends AnyZodSchema = AnyZodSchema,
  TCreateSchema extends AnyZodSchema = TSchema,
  TUpdateSchema extends AnyZodSchema = TSchema,
> {
  private input: ResourceDefinitionInput<TName, TSchema, TCreateSchema, TUpdateSchema>;

  constructor(name: TName, schema: TSchema) {
    this.input = {
      name,
      schema,
      features: {},
      permissions: [],
      hooks: {},
      relations: [],
      metadata: {},
    } as ResourceDefinitionInput<TName, TSchema, TCreateSchema, TUpdateSchema>;
  }

  /**
   * Set create schema
   */
  createSchema<T extends AnyZodSchema>(
    schema: T
  ): ResourceBuilder<TName, TSchema, T, TUpdateSchema> {
    return new ResourceBuilder<TName, TSchema, T, TUpdateSchema>(
      this.input.name,
      this.input.schema
    ).merge({
      ...this.input,
      createSchema: schema,
    } as ResourceDefinitionInput<TName, TSchema, T, TUpdateSchema>);
  }

  /**
   * Set update schema
   */
  updateSchema<T extends AnyZodSchema>(
    schema: T
  ): ResourceBuilder<TName, TSchema, TCreateSchema, T> {
    return new ResourceBuilder<TName, TSchema, TCreateSchema, T>(
      this.input.name,
      this.input.schema
    ).merge({
      ...this.input,
      updateSchema: schema,
    } as ResourceDefinitionInput<TName, TSchema, TCreateSchema, T>);
  }

  /**
   * Set resource features
   */
  features(features: Partial<ResourceFeatures>): this {
    this.input.features = { ...this.input.features, ...features };
    return this;
  }

  /**
   * Enable specific CRUD operations
   */
  enable(...operations: Array<'create' | 'read' | 'update' | 'delete' | 'list'>): this {
    for (const op of operations) {
      this.input.features = { ...this.input.features, [op]: true };
    }
    return this;
  }

  /**
   * Disable specific CRUD operations
   */
  disable(...operations: Array<'create' | 'read' | 'update' | 'delete' | 'list'>): this {
    for (const op of operations) {
      this.input.features = { ...this.input.features, [op]: false };
    }
    return this;
  }

  /**
   * Make resource read-only
   */
  readOnly(): this {
    return this.disable('create', 'update', 'delete');
  }

  /**
   * Add permission
   */
  permission(permission: PermissionDefinition): this {
    this.input.permissions = [...(this.input.permissions ?? []), permission];
    return this;
  }

  /**
   * Add multiple permissions
   */
  permissions(permissions: PermissionDefinition[]): this {
    this.input.permissions = [...(this.input.permissions ?? []), ...permissions];
    return this;
  }

  /**
   * Add custom action permission
   */
  action(action: string, description?: string): this {
    return this.permission({ action, description });
  }

  /**
   * Add relation
   */
  relation(relation: ResourceRelationDefinition): this {
    this.input.relations = [...(this.input.relations ?? []), relation];
    return this;
  }

  /**
   * Add hasOne relation
   */
  hasOne(name: string, target: string, foreignKey?: string): this {
    return this.relation({ name, type: 'hasOne', target, foreignKey });
  }

  /**
   * Add hasMany relation
   */
  hasMany(name: string, target: string, foreignKey?: string): this {
    return this.relation({ name, type: 'hasMany', target, foreignKey });
  }

  /**
   * Add belongsTo relation
   */
  belongsTo(name: string, target: string, foreignKey?: string): this {
    return this.relation({ name, type: 'belongsTo', target, foreignKey });
  }

  /**
   * Add belongsToMany relation
   */
  belongsToMany(name: string, target: string, through: string): this {
    return this.relation({ name, type: 'belongsToMany', target, through });
  }

  /**
   * Set metadata
   */
  meta(metadata: Partial<ResourceMetadata>): this {
    this.input.metadata = { ...this.input.metadata, ...metadata };
    return this;
  }

  /**
   * Set display name
   */
  displayName(name: string): this {
    return this.meta({ displayName: name });
  }

  /**
   * Set description
   */
  description(description: string): this {
    return this.meta({ description });
  }

  /**
   * Set group
   */
  group(group: string): this {
    return this.meta({ group });
  }

  /**
   * Set icon
   */
  icon(icon: string): this {
    return this.meta({ icon });
  }

  /**
   * Hide from UI
   */
  hidden(): this {
    return this.meta({ hidden: true });
  }

  /**
   * Add tags
   */
  tags(...tags: string[]): this {
    const existingTags = this.input.metadata?.tags ?? [];
    return this.meta({ tags: [...existingTags, ...tags] });
  }

  /**
   * Add hooks
   */
  hooks(hooks: Partial<ResourceHooks<InferSchema<TSchema>>>): this {
    const existing = this.input.hooks ?? {};
    this.input.hooks = {
      beforeCreate: [...(existing.beforeCreate ?? []), ...(hooks.beforeCreate ?? [])],
      afterCreate: [...(existing.afterCreate ?? []), ...(hooks.afterCreate ?? [])],
      beforeRead: [...(existing.beforeRead ?? []), ...(hooks.beforeRead ?? [])],
      afterRead: [...(existing.afterRead ?? []), ...(hooks.afterRead ?? [])],
      beforeUpdate: [...(existing.beforeUpdate ?? []), ...(hooks.beforeUpdate ?? [])],
      afterUpdate: [...(existing.afterUpdate ?? []), ...(hooks.afterUpdate ?? [])],
      beforeDelete: [...(existing.beforeDelete ?? []), ...(hooks.beforeDelete ?? [])],
      afterDelete: [...(existing.afterDelete ?? []), ...(hooks.afterDelete ?? [])],
      beforeList: [...(existing.beforeList ?? []), ...(hooks.beforeList ?? [])],
      afterList: [...(existing.afterList ?? []), ...(hooks.afterList ?? [])],
      filterQuery: [...(existing.filterQuery ?? []), ...(hooks.filterQuery ?? [])],
    };
    return this;
  }

  /**
   * Merge input
   */
  private merge(
    input: ResourceDefinitionInput<TName, TSchema, TCreateSchema, TUpdateSchema>
  ): this {
    this.input = input;
    return this;
  }

  /**
   * Build the resource definition
   */
  build(): ResourceDefinition<TName, TSchema, TCreateSchema, TUpdateSchema> {
    return defineResource(this.input);
  }
}

/**
 * Create a resource builder
 */
export function resource<TName extends string, TSchema extends AnyZodSchema>(
  name: TName,
  schema: TSchema
): ResourceBuilder<TName, TSchema, TSchema, TSchema> {
  return new ResourceBuilder(name, schema);
}
