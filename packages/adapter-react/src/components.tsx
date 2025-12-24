// @mtpc/adapter-react - MTPC 的 React 适配器组件

import React from 'react';
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
    fallback, // 权限不允许时的回退内容
    children // 权限允许时渲染的内容
  } = props;
  
  // 获取权限上下文
  const ctx = usePermissionContext();
  
  // 规范化权限输入，将单个权限或权限数组转换为统一的数组格式
  const required = normalizePermissions(permission, permissions);
  
  // 评估权限
  const result = ctx.evaluate(required, mode);
  
  // 根据 not 参数决定是否取反结果
  const allowed = not ? !result.allowed : result.allowed;

  // 权限不允许时的处理
  if (!allowed) {
    if (fallback) {
      // 有回退内容则渲染回退内容
      return <>{typeof fallback === 'function' ? fallback() : fallback}</>;
    }
    // 无回退内容则返回 null
    return null;
  }

  // 权限允许时渲染子组件
  if (typeof children === 'function') {
    // 如果 children 是函数，则调用函数并传入 allowed 参数
    return <>{children(true)}</>;
  }

  // 否则直接渲染 children
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
  // 从 props 中提取 fallback，默认值为 null
  const { fallback = null, ...rest } = props;
  
  // 调用 <Can> 组件进行权限检查
  const element = <Can {...rest} />;

  // 如果权限不允许（element 为 null），则渲染 fallback
  return element ?? (fallback as JSX.Element | null);
}