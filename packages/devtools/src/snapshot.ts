import type { MTPC, Permission, PolicyDefinition, ResourceDefinition } from '@mtpc/core';

/**
 * Snapshot of MTPC state for debug / tooling
 */
export interface MTPCSnapshot {
  resources: Array<{
    name: string;
    displayName: string;
    group?: string;
    actions: string[];
    permissions: string[];
  }>;
  permissions: string[];
  policies: Array<{
    id: string;
    name: string;
    priority: string;
    enabled: boolean;
    tenantId?: string;
    ruleCount: number;
  }>;
}

/**
 * Create a snapshot from an MTPC instance
 */
export function createSnapshot(mtpc: MTPC): MTPCSnapshot {
  const resourceDefs = mtpc.registry.resources.list();
  const permDefs = mtpc.registry.permissions.list();
  const policyDefs = mtpc.registry.policies.list();

  return {
    resources: resourceDefs.map(r => ({
      name: r.name,
      displayName: r.metadata.displayName ?? r.name,
      group: r.metadata.group,
      actions: r.permissions.map(p => p.action),
      permissions: permDefs.filter(p => p.resource === r.name).map(p => p.code),
    })),
    permissions: permDefs.map(p => p.code),
    policies: policyDefs.map(p => ({
      id: p.id,
      name: p.name,
      priority: p.priority,
      enabled: p.enabled,
      tenantId: p.tenantId,
      ruleCount: p.rules.length,
    })),
  };
}
