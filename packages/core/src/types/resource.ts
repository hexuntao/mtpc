import type { z } from 'zod';
import type { AnyZodSchema, InferSchema } from './common.js';
import type { PermissionDefinition } from './permission.js';
import type { ResourceHooks } from './hooks.js';
import type { ResourceFeatures } from './features.js';

/**
 * Resource field definition
 */
export interface ResourceFieldDefinition {
  name: string;
  type: string;
  required: boolean;
  unique?: boolean;
  indexed?: boolean;
  defaultValue?: unknown;
  description?: string;
}

/**
 * Resource relation type
 */
export type ResourceRelationType = 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';

/**
 * Resource relation definition
 */
export interface ResourceRelationDefinition {
  name: string;
  type: ResourceRelationType;
  target: string;
  foreignKey?: string;
  through?: string;
  description?: string;
}

/**
 * Resource metadata
 */
export interface ResourceMetadata {
  displayName?: string;
  pluralName?: string;
  description?: string;
  icon?: string;
  group?: string;
  sortOrder?: number;
  hidden?: boolean;
  tags?: string[];
}

/**
 * Resource definition input
 */
export interface ResourceDefinitionInput<
  TName extends string = string,
  TSchema extends AnyZodSchema = AnyZodSchema,
  TCreateSchema extends AnyZodSchema = AnyZodSchema,
  TUpdateSchema extends AnyZodSchema = AnyZodSchema,
> {
  name: TName;
  schema: TSchema;
  createSchema?: TCreateSchema;
  updateSchema?: TUpdateSchema;
  features?: Partial<ResourceFeatures>;
  permissions?: PermissionDefinition[];
  hooks?: Partial<ResourceHooks<InferSchema<TSchema>>>;
  relations?: ResourceRelationDefinition[];
  metadata?: ResourceMetadata;
}

/**
 * Resource definition (compiled)
 */
export interface ResourceDefinition<
  TName extends string = string,
  TSchema extends AnyZodSchema = AnyZodSchema,
  TCreateSchema extends AnyZodSchema = AnyZodSchema,
  TUpdateSchema extends AnyZodSchema = AnyZodSchema,
> {
  readonly name: TName;
  readonly schema: TSchema;
  readonly createSchema: TCreateSchema;
  readonly updateSchema: TUpdateSchema;
  readonly features: ResourceFeatures;
  readonly permissions: PermissionDefinition[];
  readonly hooks: ResourceHooks<InferSchema<TSchema>>;
  readonly relations: ResourceRelationDefinition[];
  readonly metadata: ResourceMetadata;
}

/**
 * Resource type helper - extract entity type from definition
 */
export type ResourceEntity<T extends ResourceDefinition> = 
  T extends ResourceDefinition<string, infer S, AnyZodSchema, AnyZodSchema>
    ? InferSchema<S>
    : never;

/**
 * Resource create input type
 */
export type ResourceCreateInput<T extends ResourceDefinition> =
  T extends ResourceDefinition<string, AnyZodSchema, infer C, AnyZodSchema>
    ? InferSchema<C>
    : never;

/**
 * Resource update input type
 */
export type ResourceUpdateInput<T extends ResourceDefinition> =
  T extends ResourceDefinition<string, AnyZodSchema, AnyZodSchema, infer U>
    ? InferSchema<U>
    : never;

/**
 * Map of all registered resources
 */
export type ResourceMap = Map<string, ResourceDefinition>;

/**
 * Extract resource names from a map
 */
export type ResourceNames<T extends ResourceMap> = T extends Map<infer K, ResourceDefinition>
  ? K
  : never;
