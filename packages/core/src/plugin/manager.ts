import type {
  PluginDefinition,
  PluginInstance,
  PluginManager,
  PluginContext,
} from '../types/index.js';

/**
 * Default plugin manager implementation
 */
export class DefaultPluginManager implements PluginManager {
  private plugins: Map<string, PluginDefinition> = new Map();
  private instances: Map<string, PluginInstance> = new Map();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * Register a plugin
   */
  register(plugin: PluginDefinition): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already registered: ${plugin.name}`);
    }

    // Check dependencies
    for (const dep of plugin.dependencies ?? []) {
      if (!this.plugins.has(dep)) {
        throw new Error(`Missing plugin dependency: ${dep} (required by ${plugin.name})`);
      }
    }

    this.plugins.set(plugin.name, plugin);
    this.instances.set(plugin.name, {
      metadata: {
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        dependencies: plugin.dependencies,
      },
      installed: false,
      initialized: false,
    });

    // Trigger onRegister
    plugin.onRegister?.(this.context);
  }

  /**
   * Install a plugin
   */
  async install(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    const instance = this.instances.get(pluginName)!;
    
    if (instance.installed) {
      return;
    }

    // Install dependencies first
    for (const dep of plugin.dependencies ?? []) {
      await this.install(dep);
    }

    // Install plugin
    await plugin.install(this.context);

    // Update instance
    this.instances.set(pluginName, {
      ...instance,
      installed: true,
    });

    // Trigger onInit
    await plugin.onInit?.(this.context);
    
    this.instances.set(pluginName, {
      ...instance,
      installed: true,
      initialized: true,
    });
  }

  /**
   * Install all registered plugins
   */
  async installAll(): Promise<void> {
    // Sort by dependencies
    const sorted = this.sortByDependencies();
    
    for (const pluginName of sorted) {
      await this.install(pluginName);
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    
    if (!plugin) {
      return;
    }

    const instance = this.instances.get(pluginName)!;
    
    if (!instance.installed) {
      return;
    }

    // Check if other plugins depend on this
    for (const [name, p] of this.plugins) {
      if (p.dependencies?.includes(pluginName) && this.instances.get(name)?.installed) {
        throw new Error(`Cannot uninstall ${pluginName}: ${name} depends on it`);
      }
    }

    // Trigger onDestroy
    await plugin.onDestroy?.();

    // Update instance
    this.instances.set(pluginName, {
      ...instance,
      installed: false,
      initialized: false,
    });
  }

  /**
   * Get plugin instance
   */
  get(pluginName: string): PluginInstance | undefined {
    return this.instances.get(pluginName);
  }

  /**
   * List all plugins
   */
  list(): PluginInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Check if plugin is installed
   */
  isInstalled(pluginName: string): boolean {
    return this.instances.get(pluginName)?.installed ?? false;
  }

  /**
   * Sort plugins by dependencies (topological sort)
   */
  private sortByDependencies(): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving: ${name}`);
      }

      visiting.add(name);

      const plugin = this.plugins.get(name);
      for (const dep of plugin?.dependencies ?? []) {
        visit(dep);
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(name);
    };

    for (const name of this.plugins.keys()) {
      visit(name);
    }

    return sorted;
  }
}

/**
 * Create plugin manager
 */
export function createPluginManager(context: PluginContext): PluginManager {
  return new DefaultPluginManager(context);
}
