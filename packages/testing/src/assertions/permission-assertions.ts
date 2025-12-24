import type { PermissionCheckResult } from '@mtpc/core';
import type { PermissionCheckSpy } from '../types.js';

/**
 * 断言权限检查结果为允许
 */
export function assertAllowed(result: PermissionCheckResult): void {
  if (!result.allowed) {
    throw new Error(
      `Expected permission "${result.permission}" to be allowed. Reason: ${result.reason}`
    );
  }
}

/**
 * 断言权限检查结果为拒绝
 */
export function assertDenied(result: PermissionCheckResult): void {
  if (result.allowed) {
    throw new Error(`Expected permission "${result.permission}" to be denied, but it was allowed`);
  }
}

/**
 * 断言权限已被检查
 */
export function assertWasChecked(spy: PermissionCheckSpy, permission: string): void {
  if (!spy.wasChecked(permission)) {
    throw new Error(`Expected permission "${permission}" to have been checked`);
  }
}

/**
 * 断言权限未被检查
 */
export function assertWasNotChecked(spy: PermissionCheckSpy, permission: string): void {
  if (spy.wasChecked(permission)) {
    throw new Error(`Expected permission "${permission}" to not have been checked`);
  }
}

/**
 * 断言检查次数
 */
export function assertCheckCount(spy: PermissionCheckSpy, expected: number): void {
  if (spy.calls.length !== expected) {
    throw new Error(`Expected ${expected} permission checks, but got ${spy.calls.length}`);
  }
}

/**
 * 断言所有检查都被允许
 */
export function assertAllChecksAllowed(spy: PermissionCheckSpy): void {
  const denied = spy.calls.filter(c => !c.result.allowed);
  if (denied.length > 0) {
    const permissions = denied.map(c => `${c.context.resource}:${c.context.action}`).join(', ');
    throw new Error(`Expected all checks to be allowed, but these were denied: ${permissions}`);
  }
}

/**
 * 断言所有检查都被拒绝
 */
export function assertAllChecksDenied(spy: PermissionCheckSpy): void {
  const allowed = spy.calls.filter(c => c.result.allowed);
  if (allowed.length > 0) {
    const permissions = allowed.map(c => `${c.context.resource}:${c.context.action}`).join(', ');
    throw new Error(`Expected all checks to be denied, but these were allowed: ${permissions}`);
  }
}
