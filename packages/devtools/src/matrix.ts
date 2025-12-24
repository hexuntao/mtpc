import type { MTPC } from '@mtpc/core';
import { createPermissionCode } from '@mtpc/shared';

/**
 * 权限矩阵行 - 用于 DevTools 展示的权限矩阵条目
 */
export interface PermissionMatrixRow {
  resource: string; // 资源名称
  action: string; // 操作类型
  permission: string; // 完整的权限编码
}

/**
 * 从 MTPC 注册表构建扁平化的权限矩阵
 * 
 * 该函数遍历所有注册的资源和权限，构建一个包含资源、操作和权限编码的矩阵，
 * 用于在 DevTools 中可视化展示权限关系。
 * 
 * @param mtpc MTPC 实例
 * @returns 权限矩阵行数组
 */
export function buildPermissionMatrix(mtpc: MTPC): PermissionMatrixRow[] {
  const rows: PermissionMatrixRow[] = [];

  // 遍历所有注册的资源
  for (const resource of mtpc.registry.resources.list()) {
    // 遍历资源的所有权限
    for (const perm of resource.permissions) {
      // 构建并添加权限矩阵行
      rows.push({
        resource: resource.name, // 资源名称
        action: perm.action, // 操作类型
        permission: createPermissionCode(resource.name, perm.action), // 完整权限编码
      });
    }
  }

  return rows;
}
