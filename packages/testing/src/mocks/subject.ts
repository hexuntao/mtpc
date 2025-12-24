import type { SubjectContext } from '@mtpc/core';
import type { MockSubjectOptions } from '../types.js';

let subjectCounter = 0;

/**
 * 创建模拟主体上下文
 */
export function createMockSubject(
  idOrOptions?: string | MockSubjectOptions,
  options?: Omit<MockSubjectOptions, 'id'>
): SubjectContext {
  const opts: MockSubjectOptions =
    typeof idOrOptions === 'string' ? { id: idOrOptions, ...options } : (idOrOptions ?? {});

  return {
    id: opts.id ?? `test-user-${++subjectCounter}`,
    type: opts.type ?? 'user',
    roles: opts.roles ?? [],
    permissions: opts.permissions ?? [],
    metadata: opts.metadata,
  };
}

/**
 * 创建匿名主体
 */
export function createAnonymousSubject(): SubjectContext {
  return {
    id: 'anonymous',
    type: 'anonymous',
    roles: [],
    permissions: [],
  };
}

/**
 * 创建具有完全访问权限的系统主体
 */
export function createSystemSubject(): SubjectContext {
  return {
    id: 'system',
    type: 'system',
    roles: ['system'],
    permissions: ['*'],
  };
}

/**
 * 创建管理员主体
 */
export function createAdminSubject(id?: string): SubjectContext {
  return createMockSubject({
    id: id ?? 'admin',
    type: 'user',
    roles: ['admin'],
    permissions: ['*'],
  });
}

/**
 * 创建具有特定角色的主体
 */
export function createSubjectWithRoles(roles: string[], id?: string): SubjectContext {
  return createMockSubject({
    id,
    roles,
  });
}

/**
 * 创建具有特定权限的主体
 */
export function createSubjectWithPermissions(permissions: string[], id?: string): SubjectContext {
  return createMockSubject({
    id,
    permissions,
  });
}

/**
 * 创建服务主体
 */
export function createServiceSubject(serviceId: string, permissions?: string[]): SubjectContext {
  return {
    id: serviceId,
    type: 'service',
    roles: [],
    permissions: permissions ?? [],
  };
}
