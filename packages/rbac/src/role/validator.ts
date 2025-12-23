import { z } from 'zod';
import type { RoleCreateInput, RoleUpdateInput } from '../types.js';

/**
 * Role name pattern
 */
const ROLE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/**
 * Role create schema
 */
export const roleCreateSchema = z.object({
  name: z
    .string()
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name must be at most 50 characters')
    .regex(
      ROLE_NAME_PATTERN,
      'Role name must start with a letter and contain only alphanumeric characters, underscores, and hyphens'
    ),
  displayName: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  type: z.enum(['system', 'custom', 'template']).default('custom'),
  permissions: z.array(z.string()).default([]),
  inherits: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Role update schema
 */
export const roleUpdateSchema = z.object({
  displayName: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  permissions: z.array(z.string()).optional(),
  inherits: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Validate role create input
 */
export function validateRoleInput(input: RoleCreateInput): void {
  const result = roleCreateSchema.safeParse(input);

  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(`Invalid role input: ${firstError.message}`);
  }
}

/**
 * Validate role update input
 */
export function validateRoleUpdateInput(input: RoleUpdateInput): void {
  const result = roleUpdateSchema.safeParse(input);

  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(`Invalid role update input: ${firstError.message}`);
  }
}

/**
 * Validate role name
 */
export function isValidRoleName(name: string): boolean {
  return ROLE_NAME_PATTERN.test(name) && name.length >= 2 && name.length <= 50;
}

/**
 * Check for circular inheritance
 */
export async function checkCircularInheritance(
  getRoleById: (id: string) => Promise<{ inherits?: string[] } | null>,
  roleId: string,
  newInherits: string[]
): Promise<boolean> {
  const visited = new Set<string>();
  const stack = [...newInherits];

  while (stack.length > 0) {
    const currentId = stack.pop()!;

    if (currentId === roleId) {
      return true; // Circular detected
    }

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    const role = await getRoleById(currentId);
    if (role?.inherits) {
      stack.push(...role.inherits);
    }
  }

  return false;
}
