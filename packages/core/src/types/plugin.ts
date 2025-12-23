import type { ResourceDefinition } from './resource.js';
import type { PolicyDefinition } from './policy.js';
import type { GlobalHooks, ResourceHooks } from './hooks.js';

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
}

/**
 * Plugin context
 */
export interface PluginContext {
  registerResource(resource: ResourceDefinition): void;
  registerPolicy(policy: PolicyDefinition): void;
  registerGlobalHooks(hooks: Partial<GlobalHooks>): void;
  extendResourceHooks<T>(resourceName: string, hooks: Partial<ResourceHooks<T>>): void;
  getResource(name: string): ResourceDefinition | undefined;
  getPolicy(id: string): PolicyDefinition | undefined;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycle {
  onRegister?(context: PluginContext): void | Promise<void>;
  onInit?(context: PluginContext): void | Promise<void>;
  onDestroy?(): void | Promise<void>;
}

/**
 * Plugin definition
 */
export interface PluginDefinition extends PluginMetadata, PluginLifecycle {
  install(context: PluginContext): void | Promise<void>;
}

/**
 * Plugin instance
 */
export interface PluginInstance {
  readonly metadata: PluginMetadata;
  readonly installed: boolean;
  readonly initialized: boolean;
}

/**
 * Plugin manager interface
 */
export interface PluginManager {
  register(plugin: PluginDefinition): void;
  install(pluginName: string): Promise<void>;
  installAll(): Promise<void>;
  uninstall(pluginName: string): Promise<void>;
  get(pluginName: string): PluginInstance | undefined;
  list(): PluginInstance[];
  isInstalled(pluginName: string): boolean;
}
