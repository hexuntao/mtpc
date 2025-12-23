import { InvalidResourceDefinitionError, ValidationError } from '@mtpc/shared';
import { z } from 'zod';
import type { AnyZodSchema, ResourceDefinition } from '../types/index.js';

/**
 * 验证资源定义
 * 检查资源定义的完整性和有效性
 * 验证名称、模式、权限和关系
 *
 * @param resource 要验证的资源定义对象
 * @throws InvalidResourceDefinitionError 验证失败时抛出
 *
 * @example
 * ```typescript
 * const userResource = resource('user', userSchema).build();
 * validateResourceDefinition(userResource); // 验证通过
 *
 * const invalidResource = { name: '123user', schema: null } as any;
 * validateResourceDefinition(invalidResource); // 抛出错误
 * ```
 */
export function validateResourceDefinition(resource: ResourceDefinition): void {
  // 验证名称
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

  // 验证模式
  if (!resource.schema || !(resource.schema instanceof z.ZodType)) {
    throw new InvalidResourceDefinitionError(
      resource.name,
      'Resource schema must be a valid Zod schema'
    );
  }

  // 验证权限
  for (const permission of resource.permissions) {
    if (!permission.action || typeof permission.action !== 'string') {
      throw new InvalidResourceDefinitionError(
        resource.name,
        'Permission action must be a non-empty string'
      );
    }
  }

  // 验证关系
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
 * 验证数据
 * 使用 Zod 模式验证数据
 *
 * @param schema Zod 验证模式
 * @param data 要验证的数据
 * @returns 验证成功时返回解析后的数据
 * @throws ValidationError 验证失败时抛出
 *
 * @example
 * ```typescript
 * const schema = z.object({ name: z.string() });
 * const data = { name: 'John' };
 * const result = validateData(schema, data); // { name: 'John' }
 *
 * validateData(schema, { name: 123 }); // 抛出错误
 * ```
 */
export function validateData<T extends AnyZodSchema>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new ValidationError(result.error);
  }

  return result.data;
}

/**
 * 验证创建输入数据
 * 使用资源的创建模式验证数据
 *
 * @param resource 资源定义对象
 * @param data 要验证的数据
 * @returns 验证成功时返回解析后的数据
 * @throws ValidationError 验证失败时抛出
 *
 * @example
 * ```typescript
 * const userResource = resource('user', userSchema)
 *   .createSchema(z.object({ name: z.string() }))
 *   .build();
 *
 * const userData = { name: 'John' };
 * const result = validateCreateInput(userResource, userData);
 * ```
 */
export function validateCreateInput<T extends ResourceDefinition>(
  resource: T,
  data: unknown
): z.infer<T['createSchema']> {
  return validateData(resource.createSchema, data);
}

/**
 * 验证更新输入数据
 * 使用资源的更新模式验证数据
 *
 * @param resource 资源定义对象
 * @param data 要验证的数据
 * @returns 验证成功时返回解析后的数据
 * @throws ValidationError 验证失败时抛出
 *
 * @example
 * ```typescript
 * const userResource = resource('user', userSchema)
 *   .updateSchema(z.object({ name: z.string().optional() }))
 *   .build();
 *
 * const updateData = { name: 'Jane' };
 * const result = validateUpdateInput(userResource, updateData);
 * ```
 */
export function validateUpdateInput<T extends ResourceDefinition>(
  resource: T,
  data: unknown
): z.infer<T['updateSchema']> {
  return validateData(resource.updateSchema, data);
}

/**
 * 安全验证
 * 验证数据但不抛出异常，返回验证结果
 *
 * @param schema Zod 验证模式
 * @param data 要验证的数据
 * @returns 验证结果对象，包含 success 标志和 data 或 error
 *
 * @example
 * ```typescript
 * const schema = z.object({ name: z.string() });
 * const data = { name: 'John' };
 * const result = safeValidate(schema, data);
 *
 * if (result.success) {
 *   console.log(result.data); // 验证成功的数据
 * } else {
 *   console.error(result.error); // Zod 错误对象
 * }
 * ```
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
