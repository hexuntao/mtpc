import {
  type AnyZodSchema,
  defineResource,
  type PermissionDefinition,
  type ResourceDefinition,
  type ResourceFeatures,
} from '@mtpc/core';

/**
 * 标准 CRUD 资源选项
 * @param name 资源名称
 * @param schema 资源模式
 * @param enable 启用 CRUD 操作
 * @param withCrudPermissions 是否自动添加 CRUD 权限
 * @param metadata 资源元数据
 */
export interface CrudResourceOptions {
  name: string;
  schema: AnyZodSchema;
  enable?: {
    create?: boolean;
    read?: boolean;
    update?: boolean;
    delete?: boolean;
    list?: boolean;
  };
  withCrudPermissions?: boolean;
  metadata?: {
    displayName?: string;
    pluralName?: string;
    description?: string;
    group?: string;
    icon?: string;
  };
}

/**
 * 快速创建标准 CRUD 资源定义
 */
export function crud(options: CrudResourceOptions): ResourceDefinition {
  const { name, schema, enable, withCrudPermissions = true, metadata } = options;

  const enabled = {
    create: enable?.create ?? true,
    read: enable?.read ?? true,
    update: enable?.update ?? true,
    delete: enable?.delete ?? true,
    list: enable?.list ?? true,
  };

  const permissions: PermissionDefinition[] = [];
  if (withCrudPermissions) {
    if (enabled.create) permissions.push({ action: 'create' });
    if (enabled.read) permissions.push({ action: 'read' });
    if (enabled.update) permissions.push({ action: 'update' });
    if (enabled.delete) permissions.push({ action: 'delete' });
    if (enabled.list) permissions.push({ action: 'list' });
  }

  const features: Partial<ResourceFeatures> = {
    create: enabled.create,
    read: enabled.read,
    update: enabled.update,
    delete: enabled.delete,
    list: enabled.list,
  };

  return defineResource({
    name,
    schema,
    permissions,
    features,
    metadata,
  });
}
