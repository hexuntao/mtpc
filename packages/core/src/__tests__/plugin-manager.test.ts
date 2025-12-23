import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultPluginManager, createPluginManager } from '../plugin/manager.js';
import { createUnifiedRegistry } from '../registry/unified-registry.js';
import { createGlobalHooksManager } from '../hooks/global.js';
import type { PluginDefinition, PluginContext } from '../types/index.js';

describe('DefaultPluginManager', () => {
  let registry: ReturnType<typeof createUnifiedRegistry>;
  let globalHooks: ReturnType<typeof createGlobalHooksManager>;
  let context: PluginContext;
  let manager: DefaultPluginManager;

  const createPluginContext = () => {
    return {
      registry: registry,
      globalHooks: globalHooks,
      policyEngine: {
        evaluate: async () => ({ effect: 'deny' } as any),
        addPolicy: () => {},
      },
      permissionResolver: async () => new Set(),
    };
  };

  beforeEach(() => {
    registry = createUnifiedRegistry();
    globalHooks = createGlobalHooksManager();
    context = createPluginContext();
    manager = new DefaultPluginManager(context);
  });

  describe('constructor', () => {
    it('should create manager instance', () => {
      expect(manager).toBeInstanceOf(DefaultPluginManager);
    });

    it('should throw on missing context', () => {
      expect(() => new DefaultPluginManager(null as any)).toThrow('context 参数不能为空');
    });
  });

  describe('register', () => {
    it('should register a plugin', () => {
      const plugin: PluginDefinition = {
        name: 'test-plugin',
        version: '1.0.0',
        install: async () => {},
      };

      manager.register(plugin);

      const instance = manager.get('test-plugin');
      expect(instance).toBeDefined();
      expect(instance?.metadata.name).toBe('test-plugin');
      expect(instance?.installed).toBe(false);
    });

    it('should throw on duplicate plugin', () => {
      const plugin: PluginDefinition = {
        name: 'test-plugin',
        version: '1.0.0',
        install: async () => {},
      };

      manager.register(plugin);
      expect(() => manager.register(plugin)).toThrow('already registered');
    });

    it('should throw on missing plugin name', () => {
      expect(() => manager.register({ name: '', version: '1.0.0' } as any))
        .toThrow('plugin.name 必须是字符串');
    });

    it('should throw on missing dependency', () => {
      const plugin: PluginDefinition = {
        name: 'dependent-plugin',
        dependencies: ['missing-plugin'],
        install: async () => {},
      };

      expect(() => manager.register(plugin)).toThrow('Missing plugin dependency: missing-plugin');
    });

    it('should trigger onRegister callback', async () => {
      let onRegisterCalled = false;
      const plugin: PluginDefinition = {
        name: 'test-plugin',
        onRegister: async () => { onRegisterCalled = true; },
        install: async () => {},
      };

      manager.register(plugin);
      expect(onRegisterCalled).toBe(true);
    });

    it('should register plugin even if onRegister throws', () => {
      // Note: onRegister is called synchronously but doesn't await
      // So if it throws, the plugin is still registered
      const plugin: PluginDefinition = {
        name: 'test-plugin',
        onRegister: async () => { throw new Error('onRegister failed'); },
        install: async () => {},
      };

      // The plugin is registered first, then onRegister is called
      // Since onRegister doesn't throw synchronously, the plugin gets registered
      manager.register(plugin);

      // Plugin is registered even if onRegister throws asynchronously
      const instance = manager.get('test-plugin');
      expect(instance).toBeDefined();
    });
  });

  describe('install', () => {
    it('should install a plugin', async () => {
      const plugin: PluginDefinition = {
        name: 'test-plugin',
        install: async () => {},
      };

      manager.register(plugin);
      await manager.install('test-plugin');

      const instance = manager.get('test-plugin');
      expect(instance?.installed).toBe(true);
      expect(instance?.initialized).toBe(true);
    });

    it('should install dependencies first', async () => {
      const order: string[] = [];
      const pluginA: PluginDefinition = {
        name: 'plugin-a',
        install: async () => { order.push('plugin-a'); },
      };
      const pluginB: PluginDefinition = {
        name: 'plugin-b',
        dependencies: ['plugin-a'],
        install: async () => { order.push('plugin-b'); },
      };

      manager.register(pluginA);
      manager.register(pluginB);
      await manager.install('plugin-b');

      expect(order).toEqual(['plugin-a', 'plugin-b']);
    });

    it('should not reinstall already installed plugin', async () => {
      let installCount = 0;
      const plugin: PluginDefinition = {
        name: 'test-plugin',
        install: async () => { installCount++; },
      };

      manager.register(plugin);
      await manager.install('test-plugin');
      await manager.install('test-plugin');

      expect(installCount).toBe(1);
    });

    it('should throw on non-existent plugin', async () => {
      await expect(manager.install('non-existent')).rejects.toThrow('Plugin not found');
    });

    it('should throw on install failure', async () => {
      const plugin: PluginDefinition = {
        name: 'test-plugin',
        install: async () => { throw new Error('Install failed'); },
      };

      manager.register(plugin);
      await expect(manager.install('test-plugin')).rejects.toThrow('Install failed');
    });

    it('should trigger onInit after install', async () => {
      let onInitCalled = false;
      const plugin: PluginDefinition = {
        name: 'test-plugin',
        install: async () => {},
        onInit: async () => { onInitCalled = true; },
      };

      manager.register(plugin);
      await manager.install('test-plugin');

      expect(onInitCalled).toBe(true);
    });

    it('should rollback on onInit failure', async () => {
      const plugin: PluginDefinition = {
        name: 'test-plugin',
        install: async () => {},
        onInit: async () => { throw new Error('onInit failed'); },
      };

      manager.register(plugin);
      await expect(manager.install('test-plugin')).rejects.toThrow('onInit failed');

      const instance = manager.get('test-plugin');
      expect(instance?.installed).toBe(false);
      expect(instance?.initialized).toBe(false);
    });
  });

  describe('installAll', () => {
    it('should install all registered plugins', async () => {
      const plugin1: PluginDefinition = {
        name: 'plugin-1',
        install: async () => {},
      };
      const plugin2: PluginDefinition = {
        name: 'plugin-2',
        install: async () => {},
      };

      manager.register(plugin1);
      manager.register(plugin2);
      await manager.installAll();

      expect(manager.isInstalled('plugin-1')).toBe(true);
      expect(manager.isInstalled('plugin-2')).toBe(true);
    });

    it('should do nothing when no plugins registered', async () => {
      await manager.installAll(); // Should not throw
    });
  });

  describe('uninstall', () => {
    it('should uninstall a plugin', async () => {
      const plugin: PluginDefinition = {
        name: 'test-plugin',
        install: async () => {},
        onDestroy: async () => {},
      };

      manager.register(plugin);
      await manager.install('test-plugin');
      await manager.uninstall('test-plugin');

      const instance = manager.get('test-plugin');
      expect(instance?.installed).toBe(false);
    });

    it('should throw when other installed plugin depends on it', async () => {
      const pluginA: PluginDefinition = {
        name: 'plugin-a',
        install: async () => {},
      };
      const pluginB: PluginDefinition = {
        name: 'plugin-b',
        dependencies: ['plugin-a'],
        install: async () => {},
      };

      manager.register(pluginA);
      manager.register(pluginB);
      await manager.installAll();

      await expect(manager.uninstall('plugin-a')).rejects.toThrow('depends on it');
    });

    it('should allow uninstall when dependent plugin not installed', async () => {
      const pluginA: PluginDefinition = {
        name: 'plugin-a',
        install: async () => {},
      };
      const pluginB: PluginDefinition = {
        name: 'plugin-b',
        dependencies: ['plugin-a'],
        install: async () => {},
      };

      manager.register(pluginA);
      manager.register(pluginB);
      await manager.install('plugin-a'); // Only install A

      await manager.uninstall('plugin-a'); // Should succeed since B is not installed

      const instance = manager.get('plugin-a');
      expect(instance?.installed).toBe(false);
    });

    it('should trigger onDestroy callback', async () => {
      let onDestroyCalled = false;
      const plugin: PluginDefinition = {
        name: 'test-plugin',
        install: async () => {},
        onDestroy: async () => { onDestroyCalled = true; },
      };

      manager.register(plugin);
      await manager.install('test-plugin');
      await manager.uninstall('test-plugin');

      expect(onDestroyCalled).toBe(true);
    });
  });

  describe('get', () => {
    it('should return plugin instance', async () => {
      const plugin: PluginDefinition = {
        name: 'test-plugin',
        version: '1.0.0',
        install: async () => {},
      };

      manager.register(plugin);
      const instance = manager.get('test-plugin');

      expect(instance).toBeDefined();
      expect(instance?.metadata.version).toBe('1.0.0');
    });

    it('should throw on invalid name', () => {
      expect(() => manager.get('')).toThrow('pluginName 必须是字符串');
    });

    it('should return undefined for non-existent plugin', () => {
      const instance = manager.get('non-existent');
      expect(instance).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list all plugins', async () => {
      manager.register({ name: 'plugin-1', install: async () => {} });
      manager.register({ name: 'plugin-2', install: async () => {} });

      const plugins = manager.list();

      expect(plugins).toHaveLength(2);
    });
  });

  describe('isInstalled', () => {
    it('should return true for installed plugin', async () => {
      manager.register({ name: 'test-plugin', install: async () => {} });
      await manager.install('test-plugin');

      expect(manager.isInstalled('test-plugin')).toBe(true);
    });

    it('should return false for uninstalled plugin', () => {
      manager.register({ name: 'test-plugin', install: async () => {} });

      expect(manager.isInstalled('test-plugin')).toBe(false);
    });

    it('should throw on invalid name', () => {
      expect(() => manager.isInstalled('')).toThrow('pluginName 必须是字符串');
    });
  });

  describe('circular dependency detection', () => {
    it('should throw on missing dependency during register', () => {
      const pluginA: PluginDefinition = {
        name: 'plugin-a',
        dependencies: ['plugin-b'], // plugin-b doesn't exist yet
        install: async () => {},
      };

      // Register plugin fails because plugin-b doesn't exist
      expect(() => manager.register(pluginA)).toThrow('Missing plugin dependency: plugin-b');
    });

    it('should register plugins with valid dependencies', () => {
      // This tests that dependency checking works correctly
      const pluginA: PluginDefinition = {
        name: 'plugin-a',
        install: async () => {},
      };
      const pluginB: PluginDefinition = {
        name: 'plugin-b',
        dependencies: ['plugin-a'],
        install: async () => {},
      };

      // Register plugin-a first
      manager.register(pluginA);

      // Register plugin-b that depends on plugin-a
      manager.register(pluginB);

      // Both should be registered
      expect(manager.get('plugin-a')).toBeDefined();
      expect(manager.get('plugin-b')).toBeDefined();
    });
  });

  describe('createPluginManager factory', () => {
    it('should create manager instance', () => {
      const manager = createPluginManager(context);
      expect(manager).toBeInstanceOf(DefaultPluginManager);
    });

    it('should throw on missing context', () => {
      expect(() => createPluginManager(null as any)).toThrow('context 参数不能为空');
    });
  });
});
