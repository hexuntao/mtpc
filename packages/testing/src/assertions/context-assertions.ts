import type { MTPCContext, SubjectContext } from '@mtpc/core';

/**
 * 断言租户 ID
 */
export function assertTenantId(ctx: MTPCContext, expectedId: string): void {
  if (ctx.tenant.id !== expectedId) {
    throw new Error(`Expected tenant ID to be "${expectedId}", but got "${ctx.tenant.id}"`);
  }
}

/**
 * 断言主体 ID
 */
export function assertSubjectId(ctx: MTPCContext, expectedId: string): void {
  if (ctx.subject.id !== expectedId) {
    throw new Error(`Expected subject ID to be "${expectedId}", but got "${ctx.subject.id}"`);
  }
}

/**
 * 断言主体类型
 */
export function assertSubjectType(ctx: MTPCContext, expectedType: SubjectContext['type']): void {
  if (ctx.subject.type !== expectedType) {
    throw new Error(`Expected subject type to be "${expectedType}", but got "${ctx.subject.type}"`);
  }
}

/**
 * 断言主体拥有角色
 */
export function assertHasRole(ctx: MTPCContext, role: string): void {
  if (!ctx.subject.roles?.includes(role)) {
    throw new Error(
      `Expected subject to have role "${role}", but roles are: ${ctx.subject.roles?.join(', ') ?? 'none'}`
    );
  }
}

/**
 * 断言主体不拥有角色
 */
export function assertNotHasRole(ctx: MTPCContext, role: string): void {
  if (ctx.subject.roles?.includes(role)) {
    throw new Error(`Expected subject to not have role "${role}"`);
  }
}

/**
 * 断言租户处于活动状态
 */
export function assertTenantActive(ctx: MTPCContext): void {
  if (ctx.tenant.status && ctx.tenant.status !== 'active') {
    throw new Error(`Expected tenant to be active, but status is "${ctx.tenant.status}"`);
  }
}

/**
 * 断言上下文拥有元数据
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
