import type {
  PluginContext,
  PluginDefinition,
  PluginInstance,
  PluginManager,
} from '../types/index.js';

/**
 * 默认插件管理器实现
 * 提供插件的注册、安装、卸载和生命周期管理功能
 * 支持插件依赖解析、拓扑排序安装和循环依赖检测
 *
 * 插件生命周期：
 * 1. 注册（register） - 仅注册，不安装
 * 2. 安装（install） - 安装插件及其依赖
 * 3. 初始化（onInit） - 插件安装后执行初始化逻辑
 * 4. 销毁（onDestroy） - 卸载插件时执行清理逻辑
 *
 * @example
 * ```typescript
 * const manager = new DefaultPluginManager(context);
 *
 * // 注册插件
 * manager.register({
 *   name: 'audit-plugin',
 *   version: '1.0.0',
 *   dependencies: ['logging-plugin'],
 *   install: async (ctx) => {
 *     // 安装逻辑
 *   },
 *   onInit: async (ctx) => {
 *     // 初始化逻辑
 *   }
 * });
 *
 * // 安装所有插件
 * await manager.installAll();
 * ```
 */
export class DefaultPluginManager implements PluginManager {
  /** 插件定义映射：插件名称 -> 插件定义 */
  private plugins: Map<string, PluginDefinition> = new Map();

  /** 插件实例映射：插件名称 -> 插件实例状态 */
  private instances: Map<string, PluginInstance> = new Map();

  /** 插件上下文，供插件访问系统功能 */
  private context: PluginContext;

  /**
   * 创建插件管理器
   * @param context 插件上下文，提供插件访问系统功能的接口
   */
  constructor(context: PluginContext) {
    // 验证上下文参数
    if (!context) {
      throw new Error('context 参数不能为空');
    }

    this.context = context;
  }

  /**
   * 注册插件
   * 将插件添加到管理器中，但不会立即安装
   * 注册时会检查依赖是否存在，但不会检查循环依赖
   *
   * @param plugin 插件定义对象，包含插件名称、版本、依赖等
   *
   * @example
   * ```typescript
   * manager.register({
   *   name: 'user-plugin',
   *   version: '1.0.0',
   *   description: '用户管理插件',
   *   author: 'MTPC Team',
   *   dependencies: ['auth-plugin'],
   *   install: async (ctx) => {
   *     ctx.registerResource({
   *       name: 'user',
   *       schema: z.object({ id: z.string(), name: z.string() })
   *     });
   *   },
   *   onInit: async (ctx) => {
   *     console.log('用户插件已初始化');
   *   },
   *   onDestroy: async () => {
   *     console.log('用户插件已销毁');
   *   }
   * });
   * ```
   */
  register(plugin: PluginDefinition): void {
    // 输入验证
    if (!plugin) {
      throw new Error('plugin 参数不能为空');
    }

    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('plugin.name 必须是字符串');
    }

    // 检查插件是否已注册
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already registered: ${plugin.name}`);
    }

    // 检查依赖是否存在
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Missing plugin dependency: ${dep} (required by ${plugin.name})`);
        }
      }
    }

    // 验证插件定义的其他字段
    if (plugin.version && typeof plugin.version !== 'string') {
      throw new Error('plugin.version 必须是字符串');
    }

    if (plugin.description && typeof plugin.description !== 'string') {
      throw new Error('plugin.description 必须是字符串');
    }

    if (plugin.author && typeof plugin.author !== 'string') {
      throw new Error('plugin.author 必须是字符串');
    }

    if (plugin.dependencies && !Array.isArray(plugin.dependencies)) {
      throw new Error('plugin.dependencies 必须是数组');
    }

    // 注册插件
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
      state: plugin.state,
    });

    // 触发 onRegister 回调
    try {
      plugin.onRegister?.(this.context);
    } catch (error) {
      // 如果 onRegister 失败，回滚注册
      this.plugins.delete(plugin.name);
      this.instances.delete(plugin.name);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Plugin onRegister failed: ${plugin.name}, ${errorMessage}`);
    }
  }

  /**
   * 安装插件
   * 递归安装插件及其所有依赖，然后执行插件的安装逻辑
   * 如果插件已安装，则直接返回
   *
   * @param pluginName 要安装的插件名称
   *
   * @example
   * ```typescript
   * // 安装单个插件（会自动安装依赖）
   * await manager.install('user-plugin');
   *
   * // 检查插件是否已安装
   * if (manager.isInstalled('user-plugin')) {
   *   console.log('用户插件已安装');
   * }
   * ```
   */
  async install(pluginName: string): Promise<void> {
    // 输入验证
    if (!pluginName || typeof pluginName !== 'string') {
      throw new Error('pluginName 必须是字符串');
    }

    const plugin = this.plugins.get(pluginName);

    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    const instance = this.instances.get(pluginName);

    if (!instance) {
      throw new Error(`Plugin instance not found: ${pluginName}`);
    }

    // 如果插件已安装，直接返回
    if (instance.installed) {
      return;
    }

    // 首先安装依赖
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        await this.install(dep);
      }
    }

    // 执行插件安装逻辑
    try {
      await plugin.install(this.context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Plugin install failed: ${pluginName}, ${errorMessage}`);
    }

    // 更新实例状态为已安装
    this.instances.set(pluginName, {
      ...instance,
      installed: true,
    });

    // 触发 onInit 回调
    try {
      await plugin.onInit?.(this.context);
    } catch (error) {
      // 如果 onInit 失败，标记为未安装
      this.instances.set(pluginName, {
        ...instance,
        installed: false,
        initialized: false,
      });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Plugin onInit failed: ${pluginName}, ${errorMessage}`);
    }

    // 更新实例状态为已初始化
    this.instances.set(pluginName, {
      ...instance,
      installed: true,
      initialized: true,
    });
  }

  /**
   * 安装所有已注册的插件
   * 按依赖顺序自动排序并安装所有插件
   *
   * @example
   * ```typescript
   * // 注册多个插件
   * manager.register(plugin1);
   * manager.register(plugin2);
   * manager.register(plugin3);
   *
   * // 安装所有插件
   * await manager.installAll();
   * ```
   */
  async installAll(): Promise<void> {
    if (this.plugins.size === 0) {
      return;
    }

    // 按依赖排序
    const sorted = this.sortByDependencies();

    // 依次安装每个插件
    for (const pluginName of sorted) {
      await this.install(pluginName);
    }
  }

  /**
   * 卸载插件
   * 卸载插件并执行清理逻辑
   * 会检查是否有其他插件依赖此插件，如果有则不允许卸载
   *
   * @param pluginName 要卸载的插件名称
   *
   * @example
   * ```typescript
   * // 卸载插件
   * await manager.uninstall('user-plugin');
   *
   * // 检查插件是否已安装
   * console.log(manager.isInstalled('user-plugin')); // false
   * ```
   */
  async uninstall(pluginName: string): Promise<void> {
    // 输入验证
    if (!pluginName || typeof pluginName !== 'string') {
      throw new Error('pluginName 必须是字符串');
    }

    const plugin = this.plugins.get(pluginName);

    if (!plugin) {
      return;
    }

    const instance = this.instances.get(pluginName);

    if (!instance) {
      return;
    }

    // 如果插件未安装，直接返回
    if (!instance.installed) {
      return;
    }

    // 检查是否有其他插件依赖此插件
    for (const [name, p] of this.plugins) {
      if (p.dependencies?.includes(pluginName)) {
        const dependentInstance = this.instances.get(name);
        if (dependentInstance?.installed) {
          throw new Error(`Cannot uninstall ${pluginName}: ${name} depends on it`);
        }
      }
    }

    // 触发 onDestroy 回调
    try {
      await plugin.onDestroy?.();
    } catch (error) {
      // 即使 onDestroy 失败，也继续卸载插件
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Plugin onDestroy failed: ${pluginName}, ${errorMessage}`);
    }

    // 更新实例状态为未安装
    this.instances.set(pluginName, {
      ...instance,
      installed: false,
      initialized: false,
    });
  }

  /**
   * 获取插件实例
   * 返回插件的当前状态信息
   *
   * @param pluginName 插件名称
   * @returns 插件实例对象，如果不存在则返回 undefined
   *
   * @example
   * ```typescript
   * const instance = manager.get('user-plugin');
   * if (instance) {
   *   console.log(`插件状态: ${instance.installed ? '已安装' : '未安装'}`);
   * }
   * ```
   */
  get(pluginName: string): PluginInstance | undefined {
    // 输入验证
    if (!pluginName || typeof pluginName !== 'string') {
      throw new Error('pluginName 必须是字符串');
    }

    return this.instances.get(pluginName);
  }

  /**
   * 列出所有插件
   * 返回所有已注册插件的实例列表
   *
   * @returns 插件实例数组
   *
   * @example
   * ```typescript
   * const plugins = manager.list();
   * console.log(`共注册了 ${plugins.length} 个插件`);
   * plugins.forEach(plugin => {
   *   console.log(`- ${plugin.metadata.name}: ${plugin.installed ? '已安装' : '未安装'}`);
   * });
   * ```
   */
  list(): PluginInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * 检查插件是否已安装
   *
   * @param pluginName 插件名称
   * @returns 如果插件已安装返回 true，否则返回 false
   *
   * @example
   * ```typescript
   * if (manager.isInstalled('user-plugin')) {
   *   console.log('用户插件已安装');
   * }
   * ```
   */
  isInstalled(pluginName: string): boolean {
    // 输入验证
    if (!pluginName || typeof pluginName !== 'string') {
      throw new Error('pluginName 必须是字符串');
    }

    return this.instances.get(pluginName)?.installed ?? false;
  }

  /**
   * 按依赖关系排序插件（拓扑排序）
   * 确保依赖插件在依赖者之前安装
   * 支持循环依赖检测
   *
   * @returns 排序后的插件名称数组
   *
   * @throws 如果检测到循环依赖，抛出错误
   *
   * @example
   * ```typescript
   * // 插件依赖关系：A -> B -> C
   * // 排序结果：[C, B, A]
   * const sorted = this.sortByDependencies();
   * console.log(sorted); // ['C', 'B', 'A']
   * ```
   */
  private sortByDependencies(): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string) => {
      // 如果已访问过，直接返回
      if (visited.has(name)) return;

      // 如果正在访问中，说明存在循环依赖
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving: ${name}`);
      }

      visiting.add(name);

      // 递归访问依赖
      const plugin = this.plugins.get(name);
      if (plugin?.dependencies) {
        for (const dep of plugin.dependencies) {
          visit(dep);
        }
      }

      // 完成访问，标记为已访问
      visiting.delete(name);
      visited.add(name);
      sorted.push(name);
    };

    // 访问所有插件
    for (const name of this.plugins.keys()) {
      visit(name);
    }

    return sorted;
  }
}

/**
 * 创建插件管理器
 * 便捷工厂函数，用于创建默认的插件管理器实例
 *
 * @param context 插件上下文，提供插件访问系统功能的接口
 * @returns 插件管理器实例
 *
 * @example
 * ```typescript
 * const context = createPluginContext(registry, globalHooks);
 * const manager = createPluginManager(context);
 *
 * // 使用管理器注册和安装插件
 * manager.register(myPlugin);
 * await manager.installAll();
 * ```
 */
export function createPluginManager(context: PluginContext): PluginManager {
  // 输入验证
  if (!context) {
    throw new Error('context 参数不能为空');
  }

  return new DefaultPluginManager(context);
}
