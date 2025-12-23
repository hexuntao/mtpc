import type { MTPCContext } from './context.js';
import type { QueryOptions, FilterCondition } from './common.js';

/**
 * Hook result
 */
export interface HookResult<T = unknown> {
  proceed: boolean;
  data?: T;
  error?: Error;
}

/**
 * Before create hook
 */
export type BeforeCreateHook<T = unknown> = (
  context: MTPCContext,
  data: T
) => Promise<HookResult<T>> | HookResult<T>;

/**
 * After create hook
 */
export type AfterCreateHook<T = unknown> = (
  context: MTPCContext,
  data: T,
  created: T
) => Promise<void> | void;

/**
 * Before read hook
 */
export type BeforeReadHook = (
  context: MTPCContext,
  id: string
) => Promise<HookResult<string>> | HookResult<string>;

/**
 * After read hook
 */
export type AfterReadHook<T = unknown> = (
  context: MTPCContext,
  id: string,
  data: T | null
) => Promise<T | null> | T | null;

/**
 * Before update hook
 */
export type BeforeUpdateHook<T = unknown> = (
  context: MTPCContext,
  id: string,
  data: Partial<T>
) => Promise<HookResult<Partial<T>>> | HookResult<Partial<T>>;

/**
 * After update hook
 */
export type AfterUpdateHook<T = unknown> = (
  context: MTPCContext,
  id: string,
  data: Partial<T>,
  updated: T
) => Promise<void> | void;

/**
 * Before delete hook
 */
export type BeforeDeleteHook = (
  context: MTPCContext,
  id: string
) => Promise<HookResult<string>> | HookResult<string>;

/**
 * After delete hook
 */
export type AfterDeleteHook<T = unknown> = (
  context: MTPCContext,
  id: string,
  deleted: T
) => Promise<void> | void;

/**
 * Before list hook
 */
export type BeforeListHook = (
  context: MTPCContext,
  options: QueryOptions
) => Promise<HookResult<QueryOptions>> | HookResult<QueryOptions>;

/**
 * After list hook
 */
export type AfterListHook<T = unknown> = (
  context: MTPCContext,
  options: QueryOptions,
  results: T[]
) => Promise<T[]> | T[];

/**
 * Filter query hook - for row-level security
 */
export type FilterQueryHook = (
  context: MTPCContext,
  baseFilters: FilterCondition[]
) => Promise<FilterCondition[]> | FilterCondition[];

/**
 * Resource hooks
 */
export interface ResourceHooks<T = unknown> {
  beforeCreate?: BeforeCreateHook<T>[];
  afterCreate?: AfterCreateHook<T>[];
  beforeRead?: BeforeReadHook[];
  afterRead?: AfterReadHook<T>[];
  beforeUpdate?: BeforeUpdateHook<T>[];
  afterUpdate?: AfterUpdateHook<T>[];
  beforeDelete?: BeforeDeleteHook[];
  afterDelete?: AfterDeleteHook<T>[];
  beforeList?: BeforeListHook[];
  afterList?: AfterListHook<T>[];
  filterQuery?: FilterQueryHook[];
}

/**
 * Global hooks - applied to all resources
 */
export interface GlobalHooks {
  beforeAny?: ((
    context: MTPCContext,
    operation: string,
    resourceName: string
  ) => Promise<HookResult> | HookResult)[];
  afterAny?: ((
    context: MTPCContext,
    operation: string,
    resourceName: string,
    result: unknown
  ) => Promise<void> | void)[];
  onError?: ((
    context: MTPCContext,
    operation: string,
    resourceName: string,
    error: Error
  ) => Promise<void> | void)[];
}

/**
 * Create empty resource hooks
 */
export function createEmptyHooks<T = unknown>(): ResourceHooks<T> {
  return {
    beforeCreate: [],
    afterCreate: [],
    beforeRead: [],
    afterRead: [],
    beforeUpdate: [],
    afterUpdate: [],
    beforeDelete: [],
    afterDelete: [],
    beforeList: [],
    afterList: [],
    filterQuery: [],
  };
}
