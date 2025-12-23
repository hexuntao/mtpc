import { z } from 'zod';
import type { ResourceDefinition, PolicyDefinition, TenantInfo } from '../types/index.js';
import { defineResource } from '../resource/define.js';

/**
 * 测试辅助函数：创建基础测试资源
 */
export function createTestResource(name: string = 'test'): ResourceDefinition {
  return defineResource({
    name,
    schema: z.object({
      id: z.string(),
      name: z.string(),
    }),
    features: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    metadata: {
      displayName: 'Test Resource',
      group: 'test',
    },
  });
}

/**
 * 测试辅助函数：创建用户资源
 */
export function createUserResource(): ResourceDefinition {
  return defineResource({
    name: 'user',
    schema: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
    }),
    features: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    metadata: {
      displayName: 'User',
      group: 'core',
    },
  });
}

/**
 * 测试辅助函数：创建订单资源
 */
export function createOrderResource(): ResourceDefinition {
  return defineResource({
    name: 'order',
    schema: z.object({
      id: z.string(),
      userId: z.string(),
      amount: z.number(),
    }),
    features: {
      create: true,
      read: true,
      update: true,
      delete: true,
      list: true,
    },
    metadata: {
      displayName: 'Order',
      group: 'business',
    },
  });
}

/**
 * 测试辅助函数：创建基础策略
 */
export function createBasicPolicy(
  id: string = 'test-policy',
  permissions: string[] = ['*'],
  effect: 'allow' | 'deny' = 'allow'
): PolicyDefinition {
  return {
    id,
    name: 'Test Policy',
    rules: [
      {
        permissions: new Set(permissions),
        effect,
        conditions: [],
      },
    ],
    priority: 'normal',
    enabled: true,
  };
}

/**
 * 测试辅助函数：创建管理员策略
 */
export function createAdminPolicy(): PolicyDefinition {
  return {
    id: 'admin-policy',
    name: 'Admin Policy',
    rules: [
      {
        permissions: new Set(['*']),
        effect: 'allow',
        conditions: [],
      },
    ],
    priority: 'high',
    enabled: true,
  };
}

/**
 * 测试辅助函数：创建基础租户信息
 */
export function createTestTenant(overrides: Partial<TenantInfo> = {}): TenantInfo {
  return {
    id: 'test-tenant',
    name: 'Test Tenant',
    status: 'active',
    ...overrides,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * 等待指定时间（用于测试异步操作）
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
