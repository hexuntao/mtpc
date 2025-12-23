import { createPermissionCode, DEFAULT_ACTIONS } from '@mtpc/shared';
import type {
  Permission,
  PermissionDefinition,
  PermissionScope,
  ResourceFeatures,
} from '../types/index.js';

/**
 * 基于资源特性生成权限定义
 * 根据资源的 CRUD 功能和高级功能，自动生成对应的权限定义
 * 支持自定义每个权限的作用域，提高权限系统的灵活性
 *
 * @param resourceName 资源名称，必须是非空字符串
 * @param features 资源特性配置，包含 CRUD 和高级功能开关
 * @param scopeConfig 可选的作用域配置，允许为每个权限单独指定作用域
 * @returns 权限定义数组
 *
 * @example
 * ```typescript
 * // 基础用法（所有权限默认作用域为 'tenant'）
 * const userPermissions = generatePermissions('user', {
 *   create: true,
 *   read: true,
 *   update: true,
 *   delete: false,
 *   list: true,
 *   advanced: {
 *     export: true,
 *     import: false,
 *     bulk: false,
 *     softDelete: false,
 *     versioning: false
 *   }
 * });
 *
 * // 自定义作用域（用户只能操作自己的资料）
 * const customPermissions = generatePermissions('user', {
 *   create: true,
 *   read: true,
 *   update: true,
 *   delete: false,
 *   list: true
 * }, {
 *   create: 'tenant',  // 创建用户需要租户级别权限
 *   read: 'own',       // 读取用户资料限制为本人
 *   update: 'own',     // 更新用户资料限制为本人
 *   list: 'tenant'     // 列出用户需要租户级别权限
 * });
 * ```
 */
export function generatePermissions(
  resourceName: string,
  features: ResourceFeatures,
  scopeConfig: Partial<Record<string, PermissionScope>> = {}
): PermissionDefinition[] {
  // 输入验证
  if (!resourceName || typeof resourceName !== 'string') {
    throw new Error('resourceName 必须是非空字符串');
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(resourceName)) {
    throw new Error('resourceName 必须以字母开头，只能包含字母、数字和下划线');
  }

  if (!features || typeof features !== 'object') {
    throw new Error('features 必须是一个对象');
  }

  // 验证基础 CRUD 属性
  if (typeof features.create !== 'boolean' ||
      typeof features.read !== 'boolean' ||
      typeof features.update !== 'boolean' ||
      typeof features.delete !== 'boolean' ||
      typeof features.list !== 'boolean') {
    throw new Error('features 的基础 CRUD 属性必须是 boolean 类型');
  }

  // 验证高级功能属性
  if (features.advanced) {
    if (typeof features.advanced !== 'object') {
      throw new Error('features.advanced 必须是一个对象');
    }

    const advancedProps = ['export', 'import', 'bulk', 'softDelete', 'versioning'] as const;
    for (const prop of advancedProps) {
      const value = (features.advanced as any)[prop];
      if (value !== undefined && typeof value !== 'boolean') {
        throw new Error(`features.advanced.${prop} 必须是 boolean 类型`);
      }
    }
  }

  // 验证作用域配置
  if (scopeConfig && typeof scopeConfig !== 'object') {
    throw new Error('scopeConfig 必须是一个对象');
  }

  const permissions: PermissionDefinition[] = [];

  // 基础 CRUD 权限
  if (features.create) {
    permissions.push({
      action: DEFAULT_ACTIONS.CREATE,
      description: `创建 ${resourceName}`,
      scope: scopeConfig.create ?? 'tenant',
    });
  }

  if (features.read) {
    permissions.push({
      action: DEFAULT_ACTIONS.READ,
      description: `读取 ${resourceName}`,
      scope: scopeConfig.read ?? 'tenant',
    });
  }

  if (features.update) {
    permissions.push({
      action: DEFAULT_ACTIONS.UPDATE,
      description: `更新 ${resourceName}`,
      scope: scopeConfig.update ?? 'tenant',
    });
  }

  if (features.delete) {
    permissions.push({
      action: DEFAULT_ACTIONS.DELETE,
      description: `删除 ${resourceName}`,
      scope: scopeConfig.delete ?? 'tenant',
    });
  }

  if (features.list) {
    permissions.push({
      action: DEFAULT_ACTIONS.LIST,
      description: `列出 ${resourceName}`,
      scope: scopeConfig.list ?? 'tenant',
    });
  }

  // 高级功能权限
  if (features.advanced?.export) {
    permissions.push({
      action: 'export',
      description: `导出 ${resourceName}`,
      scope: scopeConfig.export ?? 'tenant',
    });
  }

  if (features.advanced?.import) {
    permissions.push({
      action: 'import',
      description: `导入 ${resourceName}`,
      scope: scopeConfig.import ?? 'tenant',
    });
  }

  if (features.advanced?.bulk) {
    permissions.push({
      action: 'bulk',
      description: `批量操作 ${resourceName}`,
      scope: scopeConfig.bulk ?? 'tenant',
    });
  }

  if (features.advanced?.softDelete) {
    permissions.push({
      action: 'softDelete',
      description: `软删除 ${resourceName}`,
      scope: scopeConfig.softDelete ?? 'tenant',
    });
  }

  if (features.advanced?.versioning) {
    permissions.push({
      action: 'versioning',
      description: `版本管理 ${resourceName}`,
      scope: scopeConfig.versioning ?? 'tenant',
    });
  }

  return permissions;
}

/**
 * 编译权限定义为完整权限对象
 * 将权限定义转换为可用于权限检查的完整权限对象
 *
 * @param resourceName 资源名称，必须符合命名规范
 * @param definition 权限定义，包含 action、description 等信息
 * @returns 编译后的权限对象
 *
 * @example
 * ```typescript
 * const permission = compilePermission('user', {
 *   action: 'create',
 *   description: '创建用户',
 *   scope: 'tenant'
 * });
 * // 返回: { code: 'user:create', resource: 'user', action: 'create', ... }
 * ```
 */
export function compilePermission(
  resourceName: string,
  definition: PermissionDefinition
): Permission {
  // 输入验证
  if (!resourceName || typeof resourceName !== 'string') {
    throw new Error('resourceName 必须是非空字符串');
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(resourceName)) {
    throw new Error('resourceName 必须以字母开头，只能包含字母、数字和下划线');
  }

  if (!definition || typeof definition !== 'object') {
    throw new Error('definition 必须是一个对象');
  }

  if (!definition.action || typeof definition.action !== 'string') {
    throw new Error('definition.action 必须是非空字符串');
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(definition.action)) {
    throw new Error('definition.action 必须以字母开头，只能包含字母、数字和下划线');
  }

  if (definition.scope && typeof definition.scope !== 'string') {
    throw new Error('definition.scope 必须是字符串');
  }

  if (definition.description && typeof definition.description !== 'string') {
    throw new Error('definition.description 必须是字符串');
  }

  if (definition.conditions && !Array.isArray(definition.conditions)) {
    throw new Error('definition.conditions 必须是一个数组');
  }

  if (definition.metadata && typeof definition.metadata !== 'object') {
    throw new Error('definition.metadata 必须是一个对象');
  }

  return {
    code: createPermissionCode(resourceName, definition.action),
    resource: resourceName,
    action: definition.action,
    scope: definition.scope ?? 'tenant',
    description: definition.description,
    conditions: definition.conditions ?? [],
    metadata: definition.metadata ?? {},
  };
}

/**
 * 编译资源的所有权限定义
 * 批量将权限定义数组转换为权限对象数组
 *
 * @param resourceName 资源名称，必须符合命名规范
 * @param definitions 权限定义数组，每个定义必须包含有效的 action
 * @returns 编译后的权限对象数组
 *
 * @example
 * ```typescript
 * const userPermissions = compileResourcePermissions('user', [
 *   { action: 'create', description: '创建用户' },
 *   { action: 'read', description: '读取用户' }
 * ]);
 * // 返回: [{ code: 'user:create', ... }, { code: 'user:read', ... }]
 * ```
 */
export function compileResourcePermissions(
  resourceName: string,
  definitions: PermissionDefinition[]
): Permission[] {
  // 输入验证
  if (!resourceName || typeof resourceName !== 'string') {
    throw new Error('resourceName 必须是非空字符串');
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(resourceName)) {
    throw new Error('resourceName 必须以字母开头，只能包含字母、数字和下划线');
  }

  if (!definitions || !Array.isArray(definitions)) {
    throw new Error('definitions 必须是一个数组');
  }

  if (definitions.length === 0) {
    throw new Error('definitions 不能为空数组');
  }

  // 验证每个定义
  for (let i = 0; i < definitions.length; i++) {
    const def = definitions[i];
    if (!def || typeof def !== 'object') {
      throw new Error(`definitions[${i}] 必须是一个对象`);
    }
    if (!def.action || typeof def.action !== 'string') {
      throw new Error(`definitions[${i}].action 必须是非空字符串`);
    }
  }

  return definitions.map(def => compilePermission(resourceName, def));
}

/**
 * 生成权限代码常量
 * 为资源的所有操作生成权限代码常量，便于在代码中使用
 *
 * @param resourceName 资源名称，必须符合命名规范
 * @param actions 操作列表，每个操作必须是非空字符串
 * @returns 权限代码常量对象
 *
 * @example
 * ```typescript
 * const codes = generatePermissionCodes('user', ['create', 'read', 'update']);
 * // 返回: {
 * //   USER_CREATE: 'user:create',
 * //   USER_READ: 'user:read',
 * //   USER_UPDATE: 'user:update'
 * // }
 * ```
 */
export function generatePermissionCodes<T extends string>(
  resourceName: T,
  actions: string[]
): Record<string, string> {
  // 输入验证
  if (!resourceName || typeof resourceName !== 'string') {
    throw new Error('resourceName 必须是非空字符串');
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(resourceName)) {
    throw new Error('resourceName 必须以字母开头，只能包含字母、数字和下划线');
  }

  if (!actions || !Array.isArray(actions)) {
    throw new Error('actions 必须是一个数组');
  }

  if (actions.length === 0) {
    throw new Error('actions 不能为空数组');
  }

  // 验证每个操作
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (!action || typeof action !== 'string') {
      throw new Error(`actions[${i}] 必须是非空字符串`);
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(action)) {
      throw new Error(`actions[${i}] 必须以字母开头，只能包含字母、数字和下划线`);
    }
  }

  const codes: Record<string, string> = {};

  for (const action of actions) {
    const key = `${resourceName.toUpperCase()}_${action.toUpperCase()}`;
    codes[key] = createPermissionCode(resourceName, action);
  }

  return codes;
}

/**
 * 从多个资源生成所有权限代码常量
 * 汇总所有资源的权限代码常量
 *
 * @param resources 资源数组，每个资源包含名称和权限定义
 * @returns 所有权限代码常量对象
 *
 * @example
 * ```typescript
 * const allCodes = generateAllPermissionCodes([
 *   { name: 'user', permissions: [{ action: 'create' }, { action: 'read' }] },
 *   { name: 'order', permissions: [{ action: 'create' }, { action: 'update' }] }
 * ]);
 * // 返回: {
 * //   USER_CREATE: 'user:create',
 * //   USER_READ: 'user:read',
 * //   ORDER_CREATE: 'order:create',
 * //   ORDER_UPDATE: 'order:update'
 * // }
 * ```
 */
export function generateAllPermissionCodes(
  resources: Array<{ name: string; permissions: PermissionDefinition[] }>
): Record<string, string> {
  // 输入验证
  if (!resources || !Array.isArray(resources)) {
    throw new Error('resources 必须是一个数组');
  }

  if (resources.length === 0) {
    throw new Error('resources 不能为空数组');
  }

  // 验证每个资源
  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i];
    if (!resource || typeof resource !== 'object') {
      throw new Error(`resources[${i}] 必须是一个对象`);
    }

    if (!resource.name || typeof resource.name !== 'string') {
      throw new Error(`resources[${i}].name 必须是非空字符串`);
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(resource.name)) {
      throw new Error(`resources[${i}].name 必须以字母开头，只能包含字母、数字和下划线`);
    }

    if (!resource.permissions || !Array.isArray(resource.permissions)) {
      throw new Error(`resources[${i}].permissions 必须是一个数组`);
    }

    if (resource.permissions.length === 0) {
      throw new Error(`resources[${i}].permissions 不能为空数组`);
    }

    // 验证权限定义
    for (let j = 0; j < resource.permissions.length; j++) {
      const perm = resource.permissions[j];
      if (!perm || typeof perm !== 'object') {
        throw new Error(`resources[${i}].permissions[${j}] 必须是一个对象`);
      }
      if (!perm.action || typeof perm.action !== 'string') {
        throw new Error(`resources[${i}].permissions[${j}].action 必须是非空字符串`);
      }
    }
  }

  const codes: Record<string, string> = {};

  for (const resource of resources) {
    const resourceCodes = generatePermissionCodes(
      resource.name,
      resource.permissions.map(p => p.action)
    );
    Object.assign(codes, resourceCodes);
  }

  return codes;
}
