import { defineResource, type ResourceDefinition } from '@mtpc/core';
import { z } from 'zod';

/**
 * 创建用于测试的最小模拟资源
 */
export function createMockResource(
  name: string,
  options: {
    actions?: string[];
    features?: Partial<ResourceDefinition['features']>;
  } = {}
): ResourceDefinition {
  const { actions = ['create', 'read', 'update', 'delete', 'list'], features } = options;

  return defineResource({
    name,
    schema: z.object({
      id: z.string().uuid(),
      name: z.string(),
      tenantId: z.string().uuid(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
    createSchema: z.object({
      name: z.string(),
    }),
    permissions: actions.map(action => ({ action })),
    features: {
      create: actions.includes('create'),
      read: actions.includes('read'),
      update: actions.includes('update'),
      delete: actions.includes('delete'),
      list: actions.includes('list'),
      ...features,
    },
    metadata: {
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
    },
  });
}

/**
 * 创建标准测试资源
 */
export function createTestResources(): ResourceDefinition[] {
  return [
    createMockResource('product'),
    createMockResource('order', {
      actions: ['create', 'read', 'update', 'list', 'confirm', 'cancel'],
    }),
    createMockResource('customer'),
  ];
}
