import { z } from 'zod';
import { generatePermissions } from '../permission/generate.js';
import type { AnyZodSchema, ResourceDefinition, ResourceDefinitionInput } from '../types/index.js';
import { createEmptyHooks, createResourceFeatures } from '../types/index.js';

/**
 * Define a new resource
 */
export function defineResource<
  const TName extends string,
  const TSchema extends AnyZodSchema,
  const TCreateSchema extends AnyZodSchema = TSchema,
  const TUpdateSchema extends AnyZodSchema = TSchema,
>(
  input: ResourceDefinitionInput<TName, TSchema, TCreateSchema, TUpdateSchema>
): ResourceDefinition<TName, TSchema, TCreateSchema, TUpdateSchema> {
  const features = createResourceFeatures(input.features);

  // Generate create schema if not provided
  const createSchema = (input.createSchema ?? input.schema) as TCreateSchema;

  // Generate update schema if not provided (partial of main schema)
  const updateSchema = (() => {
    if (input.updateSchema) {
      return input.updateSchema;
    }

    // Only generate partial for ZodObject types
    if (input.schema instanceof z.ZodObject) {
      return input.schema.partial();
    }

    // For non-object schemas, use the original schema
    return input.schema;
  })() as TUpdateSchema;

  // Generate default permissions based on features
  const basePermissions = generatePermissions(input.name, features);
  const customPermissions = input.permissions ?? [];

  // Merge permissions, custom ones take precedence
  const permissionMap = new Map(basePermissions.map(p => [p.action, p]));
  for (const p of customPermissions) {
    permissionMap.set(p.action, p);
  }

  return {
    name: input.name,
    schema: input.schema,
    createSchema,
    updateSchema,
    features,
    permissions: Array.from(permissionMap.values()),
    hooks: {
      ...createEmptyHooks(),
      ...input.hooks,
    },
    relations: input.relations ?? [],
    metadata: {
      displayName: input.metadata?.displayName ?? formatDisplayName(input.name),
      pluralName: input.metadata?.pluralName ?? pluralizeDisplayName(input.name),
      description: input.metadata?.description,
      icon: input.metadata?.icon,
      group: input.metadata?.group,
      sortOrder: input.metadata?.sortOrder ?? 0,
      hidden: input.metadata?.hidden ?? false,
      tags: input.metadata?.tags ?? [],
    },
  };
}

/**
 * Format resource name to display name
 */
function formatDisplayName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^./, s => s.toUpperCase());
}

/**
 * Pluralize display name (simple implementation)
 */
function pluralizeDisplayName(name: string): string {
  const displayName = formatDisplayName(name);
  if (displayName.endsWith('y')) {
    return displayName.slice(0, -1) + 'ies';
  }
  if (
    displayName.endsWith('s') ||
    displayName.endsWith('x') ||
    displayName.endsWith('ch') ||
    displayName.endsWith('sh')
  ) {
    return displayName + 'es';
  }
  return displayName + 's';
}
