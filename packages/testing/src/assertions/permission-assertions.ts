import type { PermissionCheckResult } from '@mtpc/core';
import type { PermissionCheckSpy } from '../types.js';

/**
 * Assert that a permission check result is allowed
 */
export function assertAllowed(result: PermissionCheckResult): void {
  if (!result.allowed) {
    throw new Error(
      `Expected permission "${result.permission}" to be allowed. Reason: ${result.reason}`
    );
  }
}

/**
 * Assert that a permission check result is denied
 */
export function assertDenied(result: PermissionCheckResult): void {
  if (result.allowed) {
    throw new Error(`Expected permission "${result.permission}" to be denied, but it was allowed`);
  }
}

/**
 * Assert that a permission was checked
 */
export function assertWasChecked(spy: PermissionCheckSpy, permission: string): void {
  if (!spy.wasChecked(permission)) {
    throw new Error(`Expected permission "${permission}" to have been checked`);
  }
}

/**
 * Assert that a permission was not checked
 */
export function assertWasNotChecked(spy: PermissionCheckSpy, permission: string): void {
  if (spy.wasChecked(permission)) {
    throw new Error(`Expected permission "${permission}" to not have been checked`);
  }
}

/**
 * Assert check count
 */
export function assertCheckCount(spy: PermissionCheckSpy, expected: number): void {
  if (spy.calls.length !== expected) {
    throw new Error(`Expected ${expected} permission checks, but got ${spy.calls.length}`);
  }
}

/**
 * Assert all checks were allowed
 */
export function assertAllChecksAllowed(spy: PermissionCheckSpy): void {
  const denied = spy.calls.filter(c => !c.result.allowed);
  if (denied.length > 0) {
    const permissions = denied.map(c => `${c.context.resource}:${c.context.action}`).join(', ');
    throw new Error(`Expected all checks to be allowed, but these were denied: ${permissions}`);
  }
}

/**
 * Assert all checks were denied
 */
export function assertAllChecksDenied(spy: PermissionCheckSpy): void {
  const allowed = spy.calls.filter(c => c.result.allowed);
  if (allowed.length > 0) {
    const permissions = allowed.map(c => `${c.context.resource}:${c.context.action}`).join(', ');
    throw new Error(`Expected all checks to be denied, but these were allowed: ${permissions}`);
  }
}
