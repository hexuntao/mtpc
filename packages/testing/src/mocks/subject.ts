import type { SubjectContext, SubjectType } from '@mtpc/core';
import type { MockSubjectOptions } from '../types.js';

let subjectCounter = 0;

/**
 * Create a mock subject context
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
 * Create an anonymous subject
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
 * Create a system subject with full access
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
 * Create an admin subject
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
 * Create a subject with specific roles
 */
export function createSubjectWithRoles(roles: string[], id?: string): SubjectContext {
  return createMockSubject({
    id,
    roles,
  });
}

/**
 * Create a subject with specific permissions
 */
export function createSubjectWithPermissions(permissions: string[], id?: string): SubjectContext {
  return createMockSubject({
    id,
    permissions,
  });
}

/**
 * Create a service subject
 */
export function createServiceSubject(serviceId: string, permissions?: string[]): SubjectContext {
  return {
    id: serviceId,
    type: 'service',
    roles: [],
    permissions: permissions ?? [],
  };
}
