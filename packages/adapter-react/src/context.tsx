// @mtpc/adapter-react - MTPC 的 React 适配器

import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  ApiFetcherOptions,
  DefaultApiResponse,
  PermissionContextValue,
  PermissionProviderProps,
} from './types.js';
import { evaluatePermissions } from './utils.js';

/**
 * 权限上下文
 * 用于在 React 组件树中共享 MTPC 权限状态
 */
const PermissionContext = createContext<PermissionContextValue | null>(null);

/**
 * 默认上下文值（在 Provider 挂载前使用）
 * 提供初始的空权限状态和默认的权限检查方法，确保组件不会因上下文未提供而崩溃
 */
const defaultContext: PermissionContextValue = {
  tenantId: undefined, // 租户 ID
  subjectId: undefined, // 主体 ID（用户、服务等）
  roles: [], // 角色列表
  permissions: [], // 权限列表
  loading: false, // 权限加载状态
  error: undefined, // 权限加载错误信息
  lastUpdated: undefined, // 权限最后更新时间

  // 默认权限检查方法，初始状态下所有权限都返回 false
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  evaluate: required => ({
    required,
    granted: [],
    missing: required,
    allowed: false,
  }),
  refresh: async () => {
    // 默认刷新方法，不执行任何操作
  },
};

/**
 * PermissionProvider - MTPC 权限的 React 上下文提供者
 * 用于管理和分发权限状态给所有子组件
 * @param props 提供者配置参数
 * @returns React 组件
 */
export function PermissionProvider(props: PermissionProviderProps): JSX.Element {
  const {
    children, // 子组件
    initialPermissions = [], // 初始权限（例如从 SSR 或预加载状态获取）
    initialRoles = [], // 初始角色
    tenantId, // 租户 ID
    subjectId, // 主体 ID
    fetcher, // 权限获取器，用于从远程加载权限
    autoFetch = true, // 是否自动加载权限（默认：true）
  } = props;

  // 权限状态管理
  const [permissions, setPermissions] = useState<string[]>(initialPermissions);
  const [roles, setRoles] = useState<string[]>(initialRoles);
  const [loading, setLoading] = useState<boolean>(!!(fetcher && autoFetch)); // 初始加载状态
  const [error, setError] = useState<string | undefined>(undefined); // 错误信息
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(undefined); // 最后更新时间

  /**
   * 刷新权限方法
   * 从远程获取最新的权限和角色信息
   * @returns Promise 对象
   */
  const refresh = useCallback(async () => {
    if (!fetcher) {
      return; // 如果没有提供 fetcher，直接返回
    }

    setLoading(true); // 开始加载，更新加载状态
    setError(undefined); // 清除之前的错误信息

    try {
      const result = await fetcher(); // 调用 fetcher 获取权限
      setPermissions(result.permissions ?? []); // 更新权限列表
      setRoles(result.roles ?? []); // 更新角色列表
      setLastUpdated(new Date()); // 更新最后更新时间
    } catch (err) {
      // 处理错误，将错误信息保存到状态
      setError(err instanceof Error ? err.message : '加载权限失败');
    } finally {
      setLoading(false); // 结束加载，更新加载状态
    }
  }, [fetcher]); // 仅当 fetcher 变化时重新创建

  /**
   * 自动加载权限
   * 当 fetcher 或 autoFetch 变化时，如果 autoFetch 为 true，则自动刷新权限
   */
  useEffect(() => {
    if (fetcher && autoFetch) {
      void refresh(); // 异步调用 refresh，不阻塞渲染
    }
  }, [fetcher, autoFetch, refresh]);

  /**
   * 检查单个权限是否允许
   * @param permission 权限代码，如 'user:read'
   * @returns 是否允许该权限
   */
  const can = useCallback(
    (permission: string): boolean => evaluatePermissions(permissions, [permission], 'all').allowed,
    [permissions] // 仅当 permissions 变化时重新创建
  );

  /**
   * 检查是否允许任意一个权限
   * @param perms 权限代码数组，如 ['user:read', 'user:write']
   * @returns 是否允许任意一个权限
   */
  const canAny = useCallback(
    (perms: string[]): boolean => evaluatePermissions(permissions, perms, 'any').allowed,
    [permissions] // 仅当 permissions 变化时重新创建
  );

  /**
   * 检查是否允许所有权限
   * @param perms 权限代码数组，如 ['user:read', 'user:write']
   * @returns 是否允许所有权限
   */
  const canAll = useCallback(
    (perms: string[]): boolean => evaluatePermissions(permissions, perms, 'all').allowed,
    [permissions] // 仅当 permissions 变化时重新创建
  );

  /**
   * 评估权限，返回详细的权限检查结果
   * @param perms 权限代码数组
   * @param mode 匹配模式：'all'（所有）或 'any'（任意一个）
   * @returns 权限评估结果，包含允许状态、已授予权限和缺失权限
   */
  const evaluate = useCallback(
    (perms: string[], mode = 'all' as const) => evaluatePermissions(permissions, perms, mode),
    [permissions] // 仅当 permissions 变化时重新创建
  );

  /**
   * 上下文值，使用 useMemo 优化性能
   * 仅当依赖项变化时才重新创建上下文值，避免不必要的组件重渲染
   */
  const value: PermissionContextValue = useMemo(
    () => ({
      tenantId,
      subjectId,
      roles,
      permissions,
      loading,
      error,
      lastUpdated,
      can,
      canAny,
      canAll,
      evaluate,
      refresh,
    }),
    [
      tenantId,
      subjectId,
      roles,
      permissions,
      loading,
      error,
      lastUpdated,
      can,
      canAny,
      canAll,
      evaluate,
      refresh,
    ]
  );

  // 渲染上下文提供者，将权限状态传递给所有子组件
  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

/**
 * 访问 PermissionContext 的钩子
 * 提供了一个便捷的方式来获取权限状态和检查方法
 * @returns 权限上下文值
 */
export function usePermissionContext(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  // 如果上下文未提供，则使用默认值，确保组件不会崩溃
  return ctx ?? defaultContext;
}

/**
 * 从通用 API 配置构建简单的权限获取器
 * @param options API 获取器配置
 * @returns 权限获取器函数
 */
export function createApiPermissionFetcher(
  options: ApiFetcherOptions
): () => Promise<{ permissions: string[]; roles?: string[] }> {
  const { 
    baseUrl, // API 基础 URL
    path = '/permissions', // 权限接口路径
    headers = {}, // 请求头配置
    extractor // 自定义响应提取器
  } = options;

  return async () => {
    // 发送 GET 请求获取权限
    const res = await fetch(baseUrl + path, {
      method: 'GET',
      headers,
    });

    const json = (await res.json()) as unknown;

    // 如果提供了自定义提取器，则使用它来解析响应
    if (extractor) {
      return extractor(json);
    }

    // 默认提取器，期望响应符合 DefaultApiResponse 结构
    const data = json as DefaultApiResponse;
    if (!data.success) {
      throw new Error(data.error?.message ?? '加载权限失败');
    }

    return {
      permissions: data.data?.permissions ?? [],
      roles: data.data?.roles ?? [],
    };
  };
}