import type { MTPCContext, SubjectContext, TenantContext } from '@mtpc/core';

/**
 * Assert tenant ID
 */
export function assertTenantId(ctx: MTPCContext, expectedId: string): void {
  if (ctx.tenant.id !== expectedId) {
    throw new Error(`Expected tenant ID to be "${expectedId}", but got "${ctx.tenant.id}"`);
  }
}

/**
 * Assert subject ID
 */
export function assertSubjectId(ctx: MTPCContext, expectedId: string): void {
  if (ctx.subject.id !== expectedId) {
    throw new Error(`Expected subject ID to be "${expectedId}", but got "${ctx.subject.id}"`);
  }
}

/**
 * Assert subject type
 */
export function assertSubjectType(ctx: MTPCContext, expectedType: SubjectContext['type']): void {
  if (ctx.subject.type !== expectedType) {
    throw new Error(`Expected subject type to be "${expectedType}", but got "${ctx.subject.type}"`);
  }
}

/**
 * Assert subject has role
 */
export function assertHasRole(ctx: MTPCContext, role: string): void {
  if (!ctx.subject.roles?.includes(role)) {
    throw new Error(
      `Expected subject to have role "${role}", but roles are: ${ctx.subject.roles?.join(', ') ?? 'none'}`
    );
  }
}

/**
 * Assert subject does not have role
 */
export function assertNotHasRole(ctx: MTPCContext, role: string): void {
  if (ctx.subject.roles?.includes(role)) {
    throw new Error(`Expected subject to not have role "${role}"`);
  }
}

/**
 * Assert tenant is active
 */
export function assertTenantActive(ctx: MTPCContext): void {
  if (ctx.tenant.status && ctx.tenant.status !== 'active') {
    throw new Error(`Expected tenant to be active, but status is "${ctx.tenant.status}"`);
  }
}

/**
 * Assert context has metadata
 */
export function assertHasMetadata(ctx: MTPCContext, key: string, value?: unknown): void {
  const metadata = ctx.subject.metadata ?? ctx.tenant.metadata;
  if (!metadata || !(key in metadata)) {
    throw new Error(`Expected context to have metadata key "${key}"`);
  }
  if (value !== undefined && metadata[key] !== value) {
    throw new Error(`Expected metadata "${key}" to be "${value}", but got "${metadata[key]}"`);
  }
}
