// @mtpc/adapter-react - MTPC React 适配器的类型定义

import type { ReactNode } from 'react';

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
  /** 要求的权限列表 */
  required: string[];
  /** 已授予的权限列表 */
  granted: string[];
  /** 缺失的权限列表 */
  missing: string[];
  /** 是否允许访问 */
  allowed: boolean;
}

/**
 * 权限上下文值
 * 包含当前用户的权限、角色和相关方法
 */
export interface PermissionContextValue {
  /** 租户 ID */
  tenantId?: string;
  /** 主体 ID（用户、服务等） */
  subjectId?: string;
  /** 角色列表 */
  roles: string[];
  /** 权限列表 */
  permissions: string[];
  /** 权限加载状态 */
  loading: boolean;
  /** 权限加载错误信息 */
  error?: string;
  /** 权限最后更新时间 */
  lastUpdated?: Date;

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
 * PermissionProvider 组件的属性
 */
export interface PermissionProviderProps {
  children: ReactNode; // 子组件

  /**
   * 初始权限（例如从 SSR 或预加载状态获取）
   */
  initialPermissions?: string[];

  /**
   * 初始角色
   */
  initialRoles?: string[];

  /**
   * 租户和主体标识（可选，仅用于显示）
   */
  tenantId?: string;
  subjectId?: string;

  /**
   * 远程权限获取器
   * 应返回 { permissions, roles? } 格式的数据
   */
  fetcher?: () => Promise<{
    permissions: string[];
    roles?: string[];
  }>;

  /**
   * 当提供 fetcher 时是否自动获取权限（默认：true）
   */
  autoFetch?: boolean;
}

/**
 * usePermission 钩子的配置选项
 */
export interface UsePermissionOptions {
  /** 当权限被拒绝时是否抛出错误（默认：false） */
  throwOnDenied?: boolean;
}

/**
 * <Can> 组件的属性
 */
export interface CanProps {
  /** 单个权限代码 */
  permission?: string;
  /** 权限代码数组 */
  permissions?: string[];
  /** 匹配模式：'any' 或 'all' */
  mode?: MatchMode;
  /** 是否取反，true 表示权限不允许时渲染 */
  not?: boolean;
  /** 权限不允许时的回退内容 */
  fallback?: ReactNode | (() => any);
  /** 权限允许时渲染的内容 */
  children?: ReactNode | ((allowed: boolean) => ReactNode);
}

/**
 * <Cannot> 组件的属性
 * 继承自 <Can> 组件，移除了 not 属性
 */
export interface CannotProps extends Omit<CanProps, 'not'> {}

/**
 * <PermissionGuard> 组件的属性
 * 与 <Can> 组件的属性相同
 */
export interface PermissionGuardProps extends CanProps {}

/**
 * API 权限获取器选项
 * 用于配置从 API 获取权限的行为
 */
export interface ApiFetcherOptions {
  /**
   * API 的基础 URL，例如 "/api"
   */
  baseUrl: string;

  /**
   * 权限端点路径，例如 "/permissions"
   */
  path?: string;

  /**
   * 请求中包含的可选头信息
   */
  headers?: Record<string, string>;

  /**
   * 提取器函数，用于将响应解析为 { permissions, roles } 格式
   */
  extractor?: (response: unknown) => {
    permissions: string[];
    roles?: string[];
  };
}

/**
 * 默认 API 响应形状
 * 被默认提取器使用
 */
export interface DefaultApiResponse {
  /** 请求是否成功 */
  success: boolean;
  /** 响应数据（可选） */
  data?: {
    /** 权限列表（可选） */
    permissions?: string[];
    /** 角色列表（可选） */
    roles?: string[];
    /** 其他数据（可选） */
    [key: string]: unknown;
  };
  error?: {
    /** 错误代码 */
    code: string;
    /** 错误消息 */
    message: string;
    /** 其他错误信息（可选） */
    [key: string]: unknown;
  };
}
