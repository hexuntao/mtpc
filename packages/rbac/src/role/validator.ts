import { z } from 'zod';
import type { RoleCreateInput, RoleUpdateInput } from '../types.js';

/**
 * 角色名称正则表达式模式
 * 规则：以字母开头，仅包含字母、数字、下划线和连字符
 */
const ROLE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/**
 * 角色创建验证 Schema
 * 使用 Zod 定义角色创建输入的验证规则
 *
 * 验证规则：
 * - name: 2-50 字符，以字母开头，仅包含字母、数字、下划线和连字符
 * - displayName: 最多 100 字符
 * - description: 最多 500 字符
 * - type: 必须是 'system'、'custom' 或 'template'，默认 'custom'
 * - permissions: 字符串数组，默认空数组
 * - inherits: 可选的字符串数组
 * - metadata: 可选的任意对象
 *
 * @example
 * ```typescript
 * const result = roleCreateSchema.safeParse(input);
 * if (!result.success) {
 *   console.log(result.error.errors);
 * }
 * ```
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
 * 角色更新验证 Schema
 * 使用 Zod 定义角色更新输入的验证规则
 *
 * 验证规则：
 * - displayName: 最多 100 字符
 * - description: 最多 500 字符
 * - status: 必须是 'active'、'inactive' 或 'archived'
 * - permissions: 可选的字符串数组
 * - inherits: 可选的字符串数组
 * - metadata: 可选的任意对象
 *
 * @example
 * ```typescript
 * const result = roleUpdateSchema.safeParse(input);
 * if (!result.success) {
 *   console.log(result.error.errors);
 * }
 * ```
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
 * 验证角色创建输入
 * 根据 Schema 验证角色创建输入，失败时抛出异常
 *
 * @param input 角色创建输入
 * @throws Error 验证失败时抛出异常
 *
 * @example
 * ```typescript
 * try {
 *   validateRoleInput({
 *     name: 'editor',
 *     displayName: 'Content Editor',
 *     permissions: ['content:read', 'content:write']
 *   });
 * } catch (error) {
 *   console.error('Invalid input:', error.message);
 * }
 * ```
 */
export function validateRoleInput(input: RoleCreateInput): void {
  const result = roleCreateSchema.safeParse(input);

  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(`Invalid role input: ${firstError.message}`);
  }
}

/**
 * 验证角色更新输入
 * 根据 Schema 验证角色更新输入，失败时抛出异常
 *
 * @param input 角色更新输入
 * @throws Error 验证失败时抛出异常
 *
 * @example
 * ```typescript
 * try {
 *   validateRoleUpdateInput({
 *     displayName: 'Senior Editor',
 *     status: 'active'
 *   });
 * } catch (error) {
 *   console.error('Invalid input:', error.message);
 * }
 * ```
 */
export function validateRoleUpdateInput(input: RoleUpdateInput): void {
  const result = roleUpdateSchema.safeParse(input);

  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(`Invalid role update input: ${firstError.message}`);
  }
}

/**
 * 验证角色名称格式
 * 快速检查角色名称是否符合格式要求
 *
 * @param name 角色名称
 * @returns 是否有效
 *
 * @example
 * ```typescript
 * if (isValidRoleName('editor')) {
 *   console.log('Valid name');
 * }
 *
 * if (!isValidRoleName('123editor')) {
 *   console.log('Must start with a letter');
 * }
 * ```
 */
export function isValidRoleName(name: string): boolean {
  return ROLE_NAME_PATTERN.test(name) && name.length >= 2 && name.length <= 50;
}

/**
 * 检查角色继承是否形成循环
 * 检测角色继承链中是否存在循环引用
 *
 * @param getRoleById 获取角色的函数
 * @param roleId 要检查的角色 ID
 * @param newInherits 新的继承角色列表
 * @returns 是否存在循环继承
 *
 * @example
 * ```typescript
 * const hasCircular = await checkCircularInheritance(
 *   async (id) => await store.getRole('tenant-001', id),
 *   'role-001',
 *   ['role-002', 'role-003']
 * );
 *
 * if (hasCircular) {
 *   throw new Error('Circular inheritance detected');
 * }
 * ```
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

    // 如果回到起始角色，检测到循环
    if (currentId === roleId) {
      return true;
    }

    // 跳过已访问的角色
    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    // 递归检查继承的角色
    const role = await getRoleById(currentId);
    if (role?.inherits) {
      stack.push(...role.inherits);
    }
  }

  return false;
}
