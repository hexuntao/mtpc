/**
 * CRUD 基础功能标志
 * 定义资源支持的 CRUD 操作
 *
 * @example
 * ```typescript
 * // 完整的 CRUD 资源
 * const fullCRUD: CRUDFeatures = {
 *   create: true,
 *   read: true,
 *   update: true,
 *   delete: true,
 *   list: true
 * };
 *
 * // 只读资源（如日志、审计记录）
 * const readOnly: CRUDFeatures = {
 *   create: false,
 *   read: true,
 *   update: false,
 *   delete: false,
 *   list: true
 * };
 * ```
 */
export interface CRUDFeatures {
  /** 是否支持创建操作 */
  create: boolean;
  /** 是否支持读取操作 */
  read: boolean;
  /** 是否支持更新操作 */
  update: boolean;
  /** 是否支持删除操作 */
  delete: boolean;
  /** 是否支持列表查询 */
  list: boolean;
}

/**
 * 高级功能标志
 * 扩展的资源和数据管理功能
 *
 * @example
 * ```typescript
 * const advancedFeatures: AdvancedFeatures = {
 *   softDelete: true,    // 软删除
 *   versioning: true,    // 版本控制
 *   audit: true,         // 审计日志
 *   search: true,        // 全文搜索
 *   export: true,        // 数据导出
 *   import: true,        // 数据导入
 *   bulk: true          // 批量操作
 * };
 * ```
 */
export interface AdvancedFeatures {
  /** 软删除（标记删除，不物理删除） */
  softDelete: boolean;
  /** 版本控制（记录数据变更历史） */
  versioning: boolean;
  /** 审计日志（记录所有操作） */
  audit: boolean;
  /** 搜索功能（全文搜索、复杂查询） */
  search: boolean;
  /** 数据导出（CSV、Excel、JSON 等格式） */
  export: boolean;
  /** 数据导入（批量导入数据） */
  import: boolean;
  /** 批量操作（批量更新、批量删除） */
  bulk: boolean;
}

/**
 * 资源功能集合
 * 包含基础 CRUD 和高级功能
 *
 * @example
 * ```typescript
 * // 产品管理资源
 * const productFeatures: ResourceFeatures = {
 *   // 基础 CRUD
 *   create: true,
 *   read: true,
 *   update: true,
 *   delete: true,
 *   list: true,
 *   // 高级功能
 *   advanced: {
 *     softDelete: true,   // 产品下架而非删除
 *     versioning: true,   // 记录价格变更历史
 *     audit: true,        // 记录所有变更
 *     search: true,       // 支持产品搜索
 *     export: true,       // 导出产品目录
 *     import: true,       // 批量导入产品
 *     bulk: false         // 不支持批量操作
 *   }
 * };
 * ```
 */
export interface ResourceFeatures extends CRUDFeatures {
  /** 高级功能配置 */
  advanced: AdvancedFeatures;
}

/**
 * 默认 CRUD 功能配置（全部启用）
 * 用于不需要特殊权限控制的资源
 *
 * @example
 * ```typescript
 * const standardFeatures: CRUDFeatures = DEFAULT_CRUD_FEATURES;
 * // 等价于: { create: true, read: true, update: true, delete: true, list: true }
 * ```
 */
export const DEFAULT_CRUD_FEATURES: CRUDFeatures = {
  create: true,
  read: true,
  update: true,
  delete: true,
  list: true,
} as const;

/**
 * 默认高级功能配置（全部禁用）
 * 大多数资源不需要高级功能
 *
 * @example
 * ```typescript
 * const basicAdvanced: AdvancedFeatures = DEFAULT_ADVANCED_FEATURES;
 * // 所有高级功能均为 false
 * ```
 */
export const DEFAULT_ADVANCED_FEATURES: AdvancedFeatures = {
  softDelete: false,
  versioning: false,
  audit: false,
  search: false,
  export: false,
  import: false,
  bulk: false,
} as const;

/**
 * 默认资源功能配置
 * 组合默认的 CRUD 和高级功能
 *
 * @example
 * ```typescript
 * const defaultFeatures: ResourceFeatures = DEFAULT_RESOURCE_FEATURES;
 * // 等价于: { ...DEFAULT_CRUD_FEATURES, advanced: DEFAULT_ADVANCED_FEATURES }
 * ```
 */
export const DEFAULT_RESOURCE_FEATURES: ResourceFeatures = {
  ...DEFAULT_CRUD_FEATURES,
  advanced: DEFAULT_ADVANCED_FEATURES,
} as const;

/**
 * 只读功能配置
 * 适用于日志、审计记录、配置等只读资源
 *
 * @example
 * ```typescript
 * // 审计日志资源
 * const auditLogFeatures: ResourceFeatures = {
 *   ...READ_ONLY_FEATURES,
 *   advanced: {
 *     ...DEFAULT_ADVANCED_FEATURES,
 *     audit: true,  // 审计日志本身需要审计
 *     search: true  // 支持搜索日志
 *   }
 * };
 * ```
 */
export const READ_ONLY_FEATURES: ResourceFeatures = {
  create: false,
  read: true,
  update: false,
  delete: false,
  list: true,
  advanced: DEFAULT_ADVANCED_FEATURES,
} as const;

/**
 * 从部分输入创建资源功能
 * 合并用户输入和默认值
 *
 * @example
 * ```typescript
 * // 1. 使用默认值
 * const features1 = createResourceFeatures();
 * // 结果: DEFAULT_RESOURCE_FEATURES
 *
 * // 2. 部分覆盖
 * const features2 = createResourceFeatures({
 *   delete: false,  // 禁用删除
 *   advanced: {
 *     audit: true    // 启用审计
 *   }
 * });
 * // 结果: { create: true, read: true, update: true, delete: false, list: true, advanced: { audit: true, ... } }
 *
 * // 3. 完全自定义
 * const features3 = createResourceFeatures({
 *   create: true,
 *   read: true,
 *   update: false,
 *   delete: false,
 *   list: true,
 *   advanced: {
 *     softDelete: true,
 *     audit: true,
 *     search: false,
 *     export: false,
 *     import: false,
 *     versioning: false,
 *     bulk: false
 *   }
 * });
 * ```
 *
 * @param input 部分功能配置（可选）
 * @returns 完整的资源功能配置
 */
export function createResourceFeatures(input?: Partial<ResourceFeatures>): ResourceFeatures {
  // 如果没有输入，使用默认配置
  if (!input) {
    return { ...DEFAULT_RESOURCE_FEATURES };
  }

  // 合并 CRUD 功能
  return {
    create: input.create ?? DEFAULT_CRUD_FEATURES.create,
    read: input.read ?? DEFAULT_CRUD_FEATURES.read,
    update: input.update ?? DEFAULT_CRUD_FEATURES.update,
    delete: input.delete ?? DEFAULT_CRUD_FEATURES.delete,
    list: input.list ?? DEFAULT_CRUD_FEATURES.list,
    // 合并高级功能
    advanced: {
      ...DEFAULT_ADVANCED_FEATURES,
      ...input.advanced,
    },
  };
}

/**
 * 从资源功能中获取启用的 CRUD 操作列表
 * 用于权限代码生成等场景
 *
 * @example
 * ```typescript
 * const features: ResourceFeatures = {
 *   create: true,
 *   read: true,
 *   update: false,
 *   delete: true,
 *   list: true,
 *   advanced: DEFAULT_ADVANCED_FEATURES
 * };
 *
 * const actions = getEnabledActions(features);
 * console.log(actions); // ['create', 'read', 'delete', 'list']
 * ```
 *
 * @param features 资源功能配置
 * @returns 启用的操作列表
 */
export function getEnabledActions(features: ResourceFeatures): string[] {
  const actions: string[] = [];

  if (features.create) actions.push('create');
  if (features.read) actions.push('read');
  if (features.update) actions.push('update');
  if (features.delete) actions.push('delete');
  if (features.list) actions.push('list');

  return actions;
}
