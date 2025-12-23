import { describe, it, expect, beforeEach } from 'vitest';
import { TenantManager, InMemoryTenantStore, createTenantManager } from '../tenant/manager.js';
import { createTestTenant } from './helpers.js';

describe('InMemoryTenantStore', () => {
  let store: InMemoryTenantStore;

  beforeEach(() => {
    store = new InMemoryTenantStore();
  });

  describe('create', () => {
    it('should create a new tenant', async () => {
      const tenant = await store.create({
        id: 'tenant-1',
        name: 'Test Tenant',
        status: 'active',
      });

      expect(tenant.id).toBe('tenant-1');
      expect(tenant.name).toBe('Test Tenant');
      expect(tenant.status).toBe('active');
      expect(tenant.createdAt).toBeInstanceOf(Date);
      expect(tenant.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw on duplicate id', async () => {
      await store.create({ id: 'tenant-1', name: 'Tenant 1', status: 'active' });

      await expect(store.create({ id: 'tenant-1', name: 'Tenant 1 Duplicate', status: 'active' }))
        .rejects.toThrow('already exists');
    });

    it('should throw on invalid id', async () => {
      await expect(store.create({ id: '', name: 'Test', status: 'active' }))
        .rejects.toThrow('must be a non-empty string');

      await expect(store.create({ id: '   ', name: 'Test', status: 'active' }))
        .rejects.toThrow('must be a non-empty string');
    });

    it('should throw on invalid status', async () => {
      await expect(store.create({ id: 'tenant-1', name: 'Test', status: 'invalid' as any }))
        .rejects.toThrow('Invalid tenant status');
    });
  });

  describe('get', () => {
    it('should get tenant by id', async () => {
      await store.create({ id: 'tenant-1', name: 'Test Tenant', status: 'active' });

      const tenant = await store.get('tenant-1');

      expect(tenant).toBeDefined();
      expect(tenant?.id).toBe('tenant-1');
    });

    it('should return null for non-existent tenant', async () => {
      const tenant = await store.get('non-existent');
      expect(tenant).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all tenants', async () => {
      await store.create({ id: 'tenant-1', name: 'Tenant 1', status: 'active' });
      await store.create({ id: 'tenant-2', name: 'Tenant 2', status: 'active' });

      const tenants = await store.list();

      expect(tenants).toHaveLength(2);
    });

    it('should return empty array when no tenants', async () => {
      const tenants = await store.list();
      expect(tenants).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update tenant', async () => {
      await store.create({ id: 'tenant-1', name: 'Original Name', status: 'active' });

      const updated = await store.update('tenant-1', { name: 'New Name', status: 'suspended' });

      expect(updated.name).toBe('New Name');
      expect(updated.status).toBe('suspended');
      expect(updated.id).toBe('tenant-1'); // id should not change
    });

    it('should throw on non-existent tenant', async () => {
      await expect(store.update('non-existent', { name: 'Test' }))
        .rejects.toThrow();
    });

    it('should not allow changing id', async () => {
      await store.create({ id: 'tenant-1', name: 'Test', status: 'active' });

      const updated = await store.update('tenant-1', { id: 'new-id' } as any);

      expect(updated.id).toBe('tenant-1');
    });
  });

  describe('delete', () => {
    it('should delete tenant', async () => {
      await store.create({ id: 'tenant-1', name: 'Test', status: 'active' });

      await store.delete('tenant-1');

      const tenant = await store.get('tenant-1');
      expect(tenant).toBeNull();
    });

    it('should throw on non-existent tenant', async () => {
      await expect(store.delete('non-existent')).rejects.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all tenants', async () => {
      await store.create({ id: 'tenant-1', name: 'Test 1', status: 'active' });
      await store.create({ id: 'tenant-2', name: 'Test 2', status: 'active' });

      store.clear();

      const tenants = await store.list();
      expect(tenants).toHaveLength(0);
    });
  });
});

describe('TenantManager', () => {
  let manager: TenantManager;
  let store: InMemoryTenantStore;

  beforeEach(() => {
    store = new InMemoryTenantStore();
    manager = new TenantManager(store, { cacheTtl: 60000 });
  });

  describe('constructor', () => {
    it('should create manager with store', () => {
      expect(manager).toBeInstanceOf(TenantManager);
    });

    it('should throw on missing store', () => {
      expect(() => new TenantManager(null as any)).toThrow('Tenant store is required');
    });

    it('should throw on invalid cache TTL', () => {
      expect(() => new TenantManager(store, { cacheTtl: 0 })).toThrow('Cache TTL must be a positive number');
      expect(() => new TenantManager(store, { cacheTtl: -100 })).toThrow('Cache TTL must be a positive number');
    });
  });

  describe('getTenant', () => {
    it('should get tenant from store', async () => {
      await store.create({ id: 'tenant-1', name: 'Test', status: 'active' });

      const tenant = await manager.getTenant('tenant-1');

      expect(tenant).toBeDefined();
      expect(tenant?.id).toBe('tenant-1');
    });

    it('should return null for non-existent tenant', async () => {
      const tenant = await manager.getTenant('non-existent');
      expect(tenant).toBeNull();
    });
  });

  describe('getTenantOrThrow', () => {
    it('should return tenant', async () => {
      await store.create({ id: 'tenant-1', name: 'Test', status: 'active' });

      const tenant = await manager.getTenantOrThrow('tenant-1');

      expect(tenant.id).toBe('tenant-1');
    });

    it('should throw on non-existent tenant', async () => {
      await expect(manager.getTenantOrThrow('non-existent')).rejects.toThrow();
    });
  });

  describe('createContext', () => {
    it('should create tenant context', async () => {
      await store.create({ id: 'tenant-1', name: 'Test', status: 'active' });

      const context = await manager.createContext('tenant-1');

      expect(context.id).toBe('tenant-1');
      expect(context.status).toBe('active');
    });

    it('should throw on non-existent tenant', async () => {
      await expect(manager.createContext('non-existent')).rejects.toThrow();
    });
  });

  describe('validateAndGetContext', () => {
    it('should validate and return context', async () => {
      await store.create({ id: 'tenant-1', name: 'Test', status: 'active' });

      const context = await manager.validateAndGetContext('tenant-1');

      expect(context.id).toBe('tenant-1');
    });

    it('should throw on non-existent tenant', async () => {
      await expect(manager.validateAndGetContext('non-existent')).rejects.toThrow();
    });
  });

  describe('listTenants', () => {
    it('should list all tenants', async () => {
      await store.create({ id: 'tenant-1', name: 'Test 1', status: 'active' });
      await store.create({ id: 'tenant-2', name: 'Test 2', status: 'active' });

      const tenants = await manager.listTenants();

      expect(tenants).toHaveLength(2);
    });
  });

  describe('createTenant', () => {
    it('should create tenant and invalidate cache', async () => {
      // First get to populate cache
      await manager.getTenant('tenant-1');

      const tenant = await manager.createTenant({
        id: 'tenant-1',
        name: 'Test',
        status: 'active',
      });

      expect(tenant.id).toBe('tenant-1');
    });

    it('should throw on invalid input', async () => {
      await expect(manager.createTenant(null as any)).rejects.toThrow('Tenant info is required');
    });
  });

  describe('updateTenant', () => {
    it('should update tenant and invalidate cache', async () => {
      await store.create({ id: 'tenant-1', name: 'Original', status: 'active' });

      const updated = await manager.updateTenant('tenant-1', { name: 'Updated' });

      expect(updated.name).toBe('Updated');
    });

    it('should throw on invalid id', async () => {
      await expect(manager.updateTenant('', { name: 'Test' })).rejects.toThrow('Tenant ID must be a non-empty string');
    });

    it('should throw on non-existent tenant', async () => {
      await expect(manager.updateTenant('non-existent', { name: 'Test' })).rejects.toThrow();
    });
  });

  describe('deleteTenant', () => {
    it('should delete tenant and invalidate cache', async () => {
      await store.create({ id: 'tenant-1', name: 'Test', status: 'active' });

      await manager.deleteTenant('tenant-1');

      const tenant = await manager.getTenant('tenant-1');
      expect(tenant).toBeNull();
    });

    it('should throw on invalid id', async () => {
      await expect(manager.deleteTenant('')).rejects.toThrow('Tenant ID must be a non-empty string');
    });
  });

  describe('caching', () => {
    it('should cache tenant data', async () => {
      await store.create({ id: 'tenant-1', name: 'Test', status: 'active' });

      // First call - should fetch from store
      await manager.getTenant('tenant-1');

      // Update in store (but cache should still have old value)
      await store.update('tenant-1', { name: 'Updated' });

      // Second call - should return cached value
      const tenant = await manager.getTenant('tenant-1');
      expect(tenant?.name).toBe('Test');
    });

    it('should invalidate cache on update', async () => {
      await store.create({ id: 'tenant-1', name: 'Original', status: 'active' });

      await manager.getTenant('tenant-1');
      await manager.updateTenant('tenant-1', { name: 'Updated' });

      // Cache should be invalidated, new value should be returned
      const tenant = await manager.getTenant('tenant-1');
      expect(tenant?.name).toBe('Updated');
    });

    it('should invalidate cache on delete', async () => {
      await store.create({ id: 'tenant-1', name: 'Test', status: 'active' });

      await manager.getTenant('tenant-1');
      await manager.deleteTenant('tenant-1');

      // Cache should be invalidated
      const tenant = await manager.getTenant('tenant-1');
      expect(tenant).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      await store.create({ id: 'tenant-1', name: 'Test', status: 'active' });

      await manager.getTenant('tenant-1');
      manager.clearCache();

      // Update in store
      await store.update('tenant-1', { name: 'Updated' });

      // Should fetch fresh data
      const tenant = await manager.getTenant('tenant-1');
      expect(tenant?.name).toBe('Updated');
    });
  });

  describe('createTenantManager factory', () => {
    it('should create manager with in-memory store', () => {
      const manager = createTenantManager();

      expect(manager).toBeInstanceOf(TenantManager);
    });

    it('should accept custom cache TTL', () => {
      const manager = createTenantManager({ cacheTtl: 120000 });
      expect(manager).toBeInstanceOf(TenantManager);
    });
  });
});
