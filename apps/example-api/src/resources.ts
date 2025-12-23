import { defineResource } from '@mtpc/core';
import { z } from 'zod';

// 产品资源
export const productResource = defineResource({
  name: 'product',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    price: z.number().positive(),
    sku: z.string().min(1).max(50),
    category: z.string().optional(),
    status: z.enum(['active', 'inactive', 'discontinued']).default('active'),
    stock: z.number().int().min(0).default(0),
    metadata: z.record(z.unknown()).optional(),
  }),
  createSchema: z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    price: z.number().positive(),
    sku: z.string().min(1).max(50),
    category: z.string().optional(),
    status: z.enum(['active', 'inactive', 'discontinued']).default('active'),
    stock: z.number().int().min(0).default(0),
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
    list: true,
    advanced: {
      softDelete: true,
      audit: true,
      export: true,
      import: true,
      bulk: false,
      search: true,
      versioning: false,
    },
  },
  permissions: [
    { action: 'export', description: '导出产品' },
    { action: 'import', description: '导入产品' },
  ],
  metadata: {
    displayName: '产品',
    pluralName: '产品列表',
    description: '产品目录管理',
    icon: 'package',
    group: 'catalog',
  },
});

// 订单资源
export const orderResource = defineResource({
  name: 'order',
  schema: z.object({
    id: z.string().uuid(),
    orderNumber: z.string(),
    customerId: z.string().uuid(),
    status: z
      .enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
      .default('pending'),
    items: z.array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })
    ),
    totalAmount: z.number().positive(),
    shippingAddress: z
      .object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        country: z.string(),
        zipCode: z.string(),
      })
      .optional(),
    notes: z.string().optional(),
  }),
  createSchema: z.object({
    customerId: z.string().uuid(),
    items: z.array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })
    ),
    shippingAddress: z
      .object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        country: z.string(),
        zipCode: z.string(),
      })
      .optional(),
    notes: z.string().optional(),
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: false, // 订单不能删除
    list: true,
    advanced: {
      softDelete: false,
      audit: true,
      export: true,
      import: false,
      bulk: false,
      search: true,
      versioning: false,
    },
  },
  permissions: [
    { action: 'confirm', description: '确认订单' },
    { action: 'ship', description: '标记为已发货' },
    { action: 'cancel', description: '取消订单' },
  ],
  metadata: {
    displayName: '订单',
    pluralName: '订单列表',
    description: '订单管理',
    icon: 'shopping-cart',
    group: 'sales',
  },
});

// 客户资源
export const customerResource = defineResource({
  name: 'customer',
  schema: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().optional(),
    status: z.enum(['active', 'inactive', 'blocked']).default('active'),
    tier: z.enum(['standard', 'silver', 'gold', 'platinum']).default('standard'),
    metadata: z.record(z.unknown()).optional(),
  }),
  createSchema: z.object({
    email: z.string().email(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().optional(),
    tier: z.enum(['standard', 'silver', 'gold', 'platinum']).default('standard'),
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
    list: true,
    advanced: {
      softDelete: true,
      audit: true,
      export: true,
      import: true,
      bulk: true,
      search: true,
      versioning: false,
    },
  },
  metadata: {
    displayName: '客户',
    pluralName: '客户列表',
    description: '客户管理',
    icon: 'users',
    group: 'crm',
  },
});

// 导出所有资源
export const resources = [productResource, orderResource, customerResource];
