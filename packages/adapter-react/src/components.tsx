// @mtpc/adapter-react - MTPC 的 React 适配器组件

import { usePermissionContext } from './context.js';
import type { CannotProps, CanProps, PermissionGuardProps } from './types.js';
import { normalizePermissions } from './utils.js';

/**
 * <Can> 组件 - 仅当权限允许时渲染子组件
 * @param props 组件配置参数
 * @returns React 组件或 null
 */
export function Can(props: CanProps): JSX.Element | null {
  const { 
    permission, // 单个权限代码
    permissions, // 权限代码数组
    mode = 'all', // 匹配模式：'all'（所有）或 'any'（任意一个）
    not = false, // 是否取反，true 表示权限不允许时渲染
    fallback , // 权限不允许时的回退内容
    children // 权限允许时渲染的内容
  } = props;
  
  const ctx = usePermissionContext();
  
  const required = normalizePermissions(permission, permissions);
  
  const result = ctx.evaluate(required, mode);
  
  const allowed = not ? !result.allowed : result.allowed;

  // 权限不允许时的处理
  if (!allowed) {
    if (fallback) {
      return <>{typeof fallback === 'function' ? fallback()  : fallback}</>;
    }
    return null;
  }

  if (typeof children === 'function') {
    return <>{children(true)}</>;
  }

  return <>{children}</>;
}

/**
 * <Cannot> 组件 - <Can> 组件的相反版本，仅当权限不允许时渲染子组件
 * 内部实现是调用 <Can> 组件并设置 not={true}
 * @param props 组件配置参数
 * @returns React 组件或 null
 */
export function Cannot(props: CannotProps): JSX.Element | null {
  return <Can {...props} not />;
}

/**
 * <PermissionGuard> - 控制部分区域访问权限的包装组件
 * 与 <Can> 组件类似，但提供了更清晰的命名和默认回退值
 * @param props 组件配置参数
 * @returns React 组件或 null
 */
export function PermissionGuard(props: PermissionGuardProps): JSX.Element | null {
  const { fallback = null, ...rest } = props;
  
  const element = <Can {...rest} />;

  return element ?? (fallback as JSX.Element | null);
}