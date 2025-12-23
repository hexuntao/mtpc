import { z } from 'zod';
import type { RoleBindingCreateInput } from '../types.js';

/**
 * 角色绑定创建验证 Schema
 * 使用 Zod 定义角色绑定创建输入的验证规则
 *
 * 验证规则：
 * - roleId: 非空字符串
 * - subjectType: 必须是 'user'、'group' 或 'service'
 * - subjectId: 非空字符串
 * - expiresAt: 可选的日期，必须是未来时间
 * - metadata: 可选的任意对象
 *
 * @example
 * ```typescript
 * const result = bindingCreateSchema.safeParse(input);
 * if (!result.success) {
 *   console.log(result.error.errors);
 * }
 * ```
 */
export const bindingCreateSchema = z.object({
  roleId: z.string().min(1, 'Role ID is required'),
  subjectType: z.enum(['user', 'group', 'service']),
  subjectId: z.string().min(1, 'Subject ID is required'),
  expiresAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * 验证角色绑定输入
 * 根据 Schema 验证角色绑定创建输入，失败时抛出异常
 *
 * @param input 角色绑定创建输入
 * @throws Error 验证失败时抛出异常
 *
 * @example
 * ```typescript
 * try {
 *   validateBindingInput({
 *     roleId: 'role-001',
 *     subjectType: 'user',
 *     subjectId: 'user-123',
 *     expiresAt: new Date('2025-12-31')
 *   });
 * } catch (error) {
 *   console.error('Invalid input:', error.message);
 * }
 * ```
 */
export function validateBindingInput(input: RoleBindingCreateInput): void {
  const result = bindingCreateSchema.safeParse(input);

  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(`Invalid binding input: ${firstError.message}`);
  }

  // 检查过期时间是否在未来
  if (input.expiresAt && input.expiresAt <= new Date()) {
    throw new Error('Expiration date must be in the future');
  }
}
