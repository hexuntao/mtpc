import type { SubjectContext, TenantContext } from '@mtpc/core';
import { createMockSubject } from '../mocks/subject.js';
import { createMockTenant } from '../mocks/tenant.js';
import type { MockMTPC, PermissionMatrixEntry } from '../types.js';
import { testPermission } from './permission.js';

/**
 * Permission matrix test result
 */
export interface MatrixTestResult {
  entry: PermissionMatrixEntry;
  actual: boolean;
  passed: boolean;
  error?: string;
}

/**
 * Permission matrix configuration
 */
export interface PermissionMatrixConfig {
  roles: Record<string, string[]>; // role -> permissions
  matrix: PermissionMatrixEntry[];
}

/**
 * Test a permission matrix
 */
export async function testPermissionMatrix(
  mtpc: MockMTPC,
  matrix: PermissionMatrixEntry[],
  rolePermissions: Record<string, string[]>,
  tenant?: TenantContext
): Promise<MatrixTestResult[]> {
  const results: MatrixTestResult[] = [];
  const testTenant = tenant ?? createMockTenant('matrix-test-tenant');

  for (const entry of matrix) {
    const permissions = rolePermissions[entry.role] ?? [];
    const subject = createMockSubject({
      id: `test-${entry.role}`,
      roles: [entry.role],
      permissions,
    });

    // Grant permissions for this subject
    mtpc.setPermissions(permissions, subject.id, testTenant.id);

    try {
      const actual = await testPermission(mtpc, entry.permission, subject, testTenant);
      results.push({
        entry,
        actual,
        passed: actual === entry.expected,
        error:
          actual !== entry.expected
            ? `Expected ${entry.expected ? 'allowed' : 'denied'}, got ${actual ? 'allowed' : 'denied'}`
            : undefined,
      });
    } catch (error) {
      results.push({
        entry,
        actual: false,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Create matrix entries for standard CRUD
 */
export function createCRUDMatrix(
  resource: string,
  roleConfig: Record<string, boolean[]> // role -> [create, read, update, delete, list]
): PermissionMatrixEntry[] {
  const actions = ['create', 'read', 'update', 'delete', 'list'];
  const entries: PermissionMatrixEntry[] = [];

  for (const [role, access] of Object.entries(roleConfig)) {
    for (let i = 0; i < actions.length; i++) {
      entries.push({
        role,
        permission: `${resource}:${actions[i]}`,
        expected: access[i] ?? false,
      });
    }
  }

  return entries;
}

/**
 * Generate matrix from role definitions
 */
export function generateMatrix(
  resources: string[],
  roles: Record<string, string[]>
): PermissionMatrixEntry[] {
  const entries: PermissionMatrixEntry[] = [];
  const actions = ['create', 'read', 'update', 'delete', 'list'];

  for (const [role, permissions] of Object.entries(roles)) {
    for (const resource of resources) {
      for (const action of actions) {
        const permission = `${resource}:${action}`;
        const expected =
          permissions.includes('*') ||
          permissions.includes(`${resource}:*`) ||
          permissions.includes(permission);

        entries.push({ role, permission, expected });
      }
    }
  }

  return entries;
}

/**
 * Assert all matrix tests pass
 */
export function assertMatrixPasses(results: MatrixTestResult[]): void {
  const failures = results.filter(r => !r.passed);

  if (failures.length > 0) {
    const messages = failures.map(f => `[${f.entry.role}] ${f.entry.permission}: ${f.error}`);
    throw new Error(`Permission matrix test failed:\n${messages.join('\n')}`);
  }
}

/**
 * Print matrix results
 */
export function printMatrixResults(results: MatrixTestResult[]): void {
  console.table(
    results.map(r => ({
      Role: r.entry.role,
      Permission: r.entry.permission,
      Expected: r.entry.expected ? '✓' : '✗',
      Actual: r.actual ? '✓' : '✗',
      Status: r.passed ? '✅' : '❌',
    }))
  );
}
