import { z } from 'zod';
import type { RoleBindingCreateInput } from '../types.js';

/**
 * Role binding create schema
 */
export const bindingCreateSchema = z.object({
  roleId: z.string().min(1, 'Role ID is required'),
  subjectType: z.enum(['user', 'group', 'service']),
  subjectId: z.string().min(1, 'Subject ID is required'),
  expiresAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Validate binding input
 */
export function validateBindingInput(input: RoleBindingCreateInput): void {
  const result = bindingCreateSchema.safeParse(input);

  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(`Invalid binding input: ${firstError.message}`);
  }

  // Check expiration date is in the future
  if (input.expiresAt && input.expiresAt <= new Date()) {
    throw new Error('Expiration date must be in the future');
  }
}
