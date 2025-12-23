/**
 * CRUD feature flags
 */
export interface CRUDFeatures {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  list: boolean;
}

/**
 * Advanced feature flags
 */
export interface AdvancedFeatures {
  softDelete: boolean;
  versioning: boolean;
  audit: boolean;
  search: boolean;
  export: boolean;
  import: boolean;
  bulk: boolean;
}

/**
 * Resource features
 */
export interface ResourceFeatures extends CRUDFeatures {
  advanced: AdvancedFeatures;
}

/**
 * Default CRUD features - all enabled
 */
export const DEFAULT_CRUD_FEATURES: CRUDFeatures = {
  create: true,
  read: true,
  update: true,
  delete: true,
  list: true,
} as const;

/**
 * Default advanced features - all disabled
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
 * Default resource features
 */
export const DEFAULT_RESOURCE_FEATURES: ResourceFeatures = {
  ...DEFAULT_CRUD_FEATURES,
  advanced: DEFAULT_ADVANCED_FEATURES,
} as const;

/**
 * Read-only features
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
 * Create resource features from partial input
 */
export function createResourceFeatures(input?: Partial<ResourceFeatures>): ResourceFeatures {
  if (!input) {
    return { ...DEFAULT_RESOURCE_FEATURES };
  }

  return {
    create: input.create ?? DEFAULT_CRUD_FEATURES.create,
    read: input.read ?? DEFAULT_CRUD_FEATURES.read,
    update: input.update ?? DEFAULT_CRUD_FEATURES.update,
    delete: input.delete ?? DEFAULT_CRUD_FEATURES.delete,
    list: input.list ?? DEFAULT_CRUD_FEATURES.list,
    advanced: {
      ...DEFAULT_ADVANCED_FEATURES,
      ...input.advanced,
    },
  };
}

/**
 * Get enabled CRUD actions from features
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
