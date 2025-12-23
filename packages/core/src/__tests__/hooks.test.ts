import { describe, it, expect, beforeEach } from 'vitest';
import { GlobalHooksManager, createGlobalHooksManager } from '../hooks/global.js';
import type { MTPCContext, HookResult } from '../types/index.js';

describe('GlobalHooksManager', () => {
  let manager: GlobalHooksManager;
  let context: MTPCContext;

  const createContext = (): MTPCContext => ({
    tenant: { id: 'tenant-1', status: 'active' },
    subject: { id: 'user-1', type: 'user', roles: ['admin'] },
    request: {
      requestId: 'req-123',
      timestamp: new Date(),
      path: '/api/users',
      method: 'GET',
    },
  });

  beforeEach(() => {
    manager = createGlobalHooksManager();
    context = createContext();
  });

  describe('constructor', () => {
    it('should create manager instance', () => {
      expect(manager).toBeInstanceOf(GlobalHooksManager);
    });
  });

  describe('addBeforeAny', () => {
    it('should add beforeAny hook', () => {
      const hook = async () => ({ proceed: true });
      manager.addBeforeAny(hook);
      expect(manager.getHooks().beforeAny).toHaveLength(1);
    });

    it('should add multiple hooks', () => {
      manager.addBeforeAny(async () => ({ proceed: true }));
      manager.addBeforeAny(async () => ({ proceed: true }));
      expect(manager.getHooks().beforeAny).toHaveLength(2);
    });
  });

  describe('addAfterAny', () => {
    it('should add afterAny hook', () => {
      const hook = async () => {};
      manager.addAfterAny(hook);
      expect(manager.getHooks().afterAny).toHaveLength(1);
    });
  });

  describe('addOnError', () => {
    it('should add onError hook', () => {
      const hook = async () => {};
      manager.addOnError(hook);
      expect(manager.getHooks().onError).toHaveLength(1);
    });
  });

  describe('executeBeforeAny', () => {
    it('should return proceed: true when no hooks', async () => {
      const result = await manager.executeBeforeAny(context, 'create', 'user');
      expect(result.proceed).toBe(true);
    });

    it('should execute hook and return result', async () => {
      manager.addBeforeAny(async () => ({ proceed: true, data: 'test' }));
      const result = await manager.executeBeforeAny(context, 'create', 'user');
      expect(result.proceed).toBe(true);
    });

    it('should stop on hook that returns proceed: false', async () => {
      let secondHookCalled = false;
      manager.addBeforeAny(async () => ({ proceed: false, reason: 'blocked' }));
      manager.addBeforeAny(async () => { secondHookCalled = true; return { proceed: true }; });

      const result = await manager.executeBeforeAny(context, 'create', 'user');
      expect(result.proceed).toBe(false);
      expect(result.reason).toBe('blocked');
      expect(secondHookCalled).toBe(false);
    });

    it('should execute all hooks when all return proceed: true', async () => {
      let callCount = 0;
      manager.addBeforeAny(async () => { callCount++; return { proceed: true }; });
      manager.addBeforeAny(async () => { callCount++; return { proceed: true }; });

      await manager.executeBeforeAny(context, 'create', 'user');
      expect(callCount).toBe(2);
    });

    it('should throw on hook execution error', async () => {
      manager.addBeforeAny(async () => { throw new Error('Hook error'); });

      await expect(manager.executeBeforeAny(context, 'create', 'user'))
        .rejects.toThrow('Hook execution failed');
    });
  });

  describe('executeAfterAny', () => {
    it('should execute afterAny hooks', async () => {
      let called = false;
      manager.addAfterAny(async () => { called = true; });

      await manager.executeAfterAny(context, 'create', 'user', { id: '1' });
      expect(called).toBe(true);
    });

    it('should execute all afterAny hooks', async () => {
      let callCount = 0;
      manager.addAfterAny(async () => { callCount++; });
      manager.addAfterAny(async () => { callCount++; });

      await manager.executeAfterAny(context, 'create', 'user', { id: '1' });
      expect(callCount).toBe(2);
    });

    it('should throw on hook execution error', async () => {
      manager.addAfterAny(async () => { throw new Error('Hook error'); });

      await expect(manager.executeAfterAny(context, 'create', 'user', { id: '1' }))
        .rejects.toThrow('Hook execution failed');
    });
  });

  describe('executeOnError', () => {
    it('should execute onError hooks', async () => {
      let called = false;
      manager.addOnError(async () => { called = true; });

      await manager.executeOnError(context, 'create', 'user', new Error('Test error'));
      expect(called).toBe(true);
    });

    it('should execute all onError hooks', async () => {
      let callCount = 0;
      manager.addOnError(async () => { callCount++; });
      manager.addOnError(async () => { callCount++; });

      await manager.executeOnError(context, 'create', 'user', new Error('Test error'));
      expect(callCount).toBe(2);
    });

    it('should not throw on onError hook error', async () => {
      manager.addOnError(async () => { throw new Error('Hook error'); });

      // Should not throw
      await manager.executeOnError(context, 'create', 'user', new Error('Test error'));
    });
  });

  describe('clear', () => {
    it('should clear all hooks', () => {
      manager.addBeforeAny(async () => ({ proceed: true }));
      manager.addAfterAny(async () => {});
      manager.addOnError(async () => {});

      manager.clear();

      const hooks = manager.getHooks();
      expect(hooks.beforeAny).toHaveLength(0);
      expect(hooks.afterAny).toHaveLength(0);
      expect(hooks.onError).toHaveLength(0);
    });
  });

  describe('getHooks', () => {
    it('should return deep copy of hooks', () => {
      const hook = async () => ({ proceed: true });
      manager.addBeforeAny(hook);

      const hooks1 = manager.getHooks();
      const hooks2 = manager.getHooks();

      // Modifying returned hooks should not affect original
      hooks1.beforeAny = [];
      expect(manager.getHooks().beforeAny).toHaveLength(1);

      // Different calls should return different objects
      expect(hooks1).not.toBe(hooks2);
    });
  });

  describe('createGlobalHooksManager factory', () => {
    it('should create manager instance', () => {
      const manager = createGlobalHooksManager();
      expect(manager).toBeInstanceOf(GlobalHooksManager);
    });
  });
});
