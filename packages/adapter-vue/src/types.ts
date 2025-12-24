// @mtpc/adapter-vue - MTPC Vue 适配器的类型定义

import type { Ref } from 'vue';

/**
 * 权限匹配模式
 * - 'any': 任意一个权限匹配即可
 * - 'all': 所有权限都必须匹配
 */
export type MatchMode = 'any' | 'all';

/**
 * 权限评估结果
 */
export interface PermissionEvalResult {
  required: string[]; // 要求的权限列表
  granted: string[]; // 已授予的权限列表
  missing: string[]; // 缺失的权限列表
  allowed: boolean; // 是否允许访问
}

/**
 * 权限上下文值
 * 包含当前用户的权限、角色和相关方法
 */
export interface PermissionContextValue {
  tenantId?: string; // 租户 ID
  subjectId?: string; // 主体 ID（用户、服务等）
  roles: Ref<string[]>; // 角色列表（Vue Ref 对象）
  permissions: Ref<string[]>; // 权限列表（Vue Ref 对象）
  loading: Ref<boolean>; // 权限加载状态（Vue Ref 对象）
  error: Ref<string | undefined>; // 权限加载错误信息（Vue Ref 对象）
  lastUpdated: Ref<Date | undefined>; // 权限最后更新时间（Vue Ref 对象）

  /**
   * 检查单个权限是否允许
   * @param permission 权限代码，如 'user:read'
   * @returns 是否允许该权限
   */
  can(permission: string): boolean;

  /**
   * 检查是否允许任意一个权限
   * @param permissions 权限代码数组，如 ['user:read', 'user:write']
   * @returns 是否允许任意一个权限
   */
  canAny(permissions: string[]): boolean;

  /**
   * 检查是否允许所有权限
   * @param permissions 权限代码数组，如 ['user:read', 'user:write']
   * @returns 是否允许所有权限
   */
  canAll(permissions: string[]): boolean;

  /**
   * 解释哪些权限是已授予/缺失的
   * @param permissions 权限代码数组
   * @param mode 匹配模式：'any' 或 'all'
   * @returns 权限评估结果
   */
  evaluate(permissions: string[], mode?: MatchMode): PermissionEvalResult;

  /**
   * 从远程刷新权限（如果配置了 fetcher）
   * @returns Promise 对象
   */
  refresh(): Promise<void>;
}

/**
 * 权限提供者配置参数
 */
export interface PermissionProviderProps {
  initialPermissions?: string[]; // 初始权限列表
  initialRoles?: string[]; // 初始角色列表
  tenantId?: string; // 租户 ID
  subjectId?: string; // 主体 ID
  fetcher?: () => Promise<{ permissions: string[]; roles?: string[] }>; // 权限获取器，用于从远程加载权限
  autoFetch?: boolean; // 是否自动加载权限（默认：true）
}

/**
 * Can 组件的属性
 */
export interface CanProps {
  permission?: string; // 单个权限代码
  permissions?: string[]; // 权限代码数组
  mode?: MatchMode; // 匹配模式：'any' 或 'all'
  not?: boolean; // 是否取反，true 表示权限不允许时渲染
}

/**
 * API 权限获取器选项
 * 用于配置从 API 获取权限的行为
 */
export interface ApiFetcherOptions {
  baseUrl: string; // API 的基础 URL，例如 "/api"
  path?: string; // 权限端点路径，例如 "/permissions"
  headers?: Record<string, string>; // 请求中包含的可选头信息
}
