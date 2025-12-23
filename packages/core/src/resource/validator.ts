import { z } from 'zod';
import type { ResourceDefinition, AnyZodSchema } from '../types/index.js';
import { ValidationError, InvalidResourceDefinitionError } from '@mtpc/shared';

/**
 * Validate resource definition
 */
export function validateResourceDefinition(
  resource: ResourceDefinition
): void {
  // Validate name
  if (!resource.name || typeof resource.name !== 'string') {
    throw new InvalidResourceDefinitionError(
      resource.name ?? 'unknown',
      'Resource name must be a non-empty string'
    );
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(resource.name)) {
    throw new InvalidResourceDefinitionError(
      resource.name,
      'Resource name must start with a letter and contain only alphanumeric characters and underscores'
    );
  }

  // Validate schema
  if (!resource.schema || !(resource.schema instanceof z.ZodType)) {
    throw new InvalidResourceDefinitionError(
      resource.name,
      'Resource schema must be a valid Zod schema'
    );
  }

  // Validate permissions
  for (const permission of resource.permissions) {
    if (!permission.action || typeof permission.action !== 'string') {
      throw new InvalidResourceDefinitionError(
        resource.name,
        'Permission action must be a non-empty string'
      );
    }
  }

  // Validate relations
  for (const relation of resource.relations) {
    if (!relation.name || !relation.target || !relation.type) {
      throw new InvalidResourceDefinitionError(
        resource.name,
        'Relation must have name, target, and type'
      );
    }
  }
}

/**
 * Validate data against resource schema
 */
export function validateData<T extends AnyZodSchema>(
  schema: T,
  data: unknown
): z.infer<T> {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    throw new ValidationError(result.error);
  }
  
  return result.data;
}

/**
 * Validate create input
 */
export function validateCreateInput<T extends ResourceDefinition>(
  resource: T,
  data: unknown
): z.infer<T['createSchema']> {
  return validateData(resource.createSchema, data);
}

/**
 * Validate update input
 */
export function validateUpdateInput<T extends ResourceDefinition>(
  resource: T,
  data: unknown
): z.infer<T['updateSchema']> {
  return validateData(resource.updateSchema, data);
}

/**
 * Safe validate - returns result instead of throwing
 */
export function safeValidate<T extends AnyZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}
