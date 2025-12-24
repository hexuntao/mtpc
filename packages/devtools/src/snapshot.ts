import type { MTPC, Permission, PolicyDefinition, ResourceDefinition } from '@mtpc/core';

/**
 * MTPC 状态快照 - 用于调试和工具展示的 MTPC 状态快照
 * 
 * 包含资源、权限和策略的关键信息，用于 DevTools 可视化展示和调试。
 */
export interface MTPCSnapshot {
  resources: Array<{ // 资源列表
    name: string; // 资源名称
    displayName: string; // 资源显示名称
    group?: string; // 资源分组
    actions: string[]; // 支持的操作列表
    permissions: string[]; // 资源相关的权限编码列表
  }>;
  permissions: string[]; // 所有权限编码列表
  policies: Array<{ // 策略列表
    id: string; // 策略 ID
    name: string; // 策略名称
    priority: string; // 策略优先级
    enabled: boolean; // 是否启用
    tenantId?: string; // 租户 ID（可选）
    ruleCount: number; // 规则数量
  }>;
}

/**
 * 从 MTPC 实例创建状态快照
 * 
 * 该函数从 MTPC 实例的注册表中提取资源、权限和策略的关键信息，
 * 构建一个结构化的快照，用于 DevTools 可视化展示和调试。
 * 
 * @param mtpc MTPC 实例
 * @returns MTPC 状态快照
 */
export function createSnapshot(mtpc: MTPC): MTPCSnapshot {
  // 获取所有注册的资源、权限和策略定义
  const resourceDefs = mtpc.registry.resources.list();
  const permDefs = mtpc.registry.permissions.list();
  const policyDefs = mtpc.registry.policies.list();

  return {
    // 构建资源快照信息
    resources: resourceDefs.map(r => ({
      name: r.name,
      displayName: r.metadata.displayName ?? r.name, // 使用元数据中的显示名称，否则使用资源名称
      group: r.metadata.group,
      actions: r.permissions.map(p => p.action), // 提取资源支持的所有操作
      permissions: permDefs.filter(p => p.resource === r.name).map(p => p.code), // 提取资源相关的所有权限编码
    })),
    // 构建所有权限编码列表
    permissions: permDefs.map(p => p.code),
    // 构建策略快照信息
    policies: policyDefs.map(p => ({
      id: p.id,
      name: p.name,
      priority: p.priority,
      enabled: p.enabled,
      tenantId: p.tenantId,
      ruleCount: p.rules.length, // 统计策略包含的规则数量
    })),
  };
}
