import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateCondition, fieldCondition, timeCondition, ipCondition, customCondition } from '../policy/conditions.js';
import type { PolicyCondition, PolicyEvaluationContext } from '../types/index.js';

describe('Policy Conditions', () => {
  let baseContext: PolicyEvaluationContext;

  beforeEach(() => {
    baseContext = {
      tenant: { id: 'tenant-1', name: 'Test Tenant' },
      subject: {
        id: 'user-1',
        type: 'user' as const,
        roles: ['admin', 'developer'],
        permissions: ['user:read', 'user:write'],
      },
      permission: { code: 'user:read', resource: 'user', action: 'read' },
      resource: { id: 'resource-1', ownerId: 'user-1', status: 'active', tags: ['important', 'urgent'] },
      request: {
        timestamp: new Date('2024-06-15T10:30:00Z'),
        ip: '192.168.1.100',
        path: '/api/users',
        method: 'GET',
      },
      environment: { stage: 'production' },
    };
  });

  describe('evaluateCondition - input validation', () => {
    it('should return false for null condition', async () => {
      const result = await evaluateCondition(null as any, baseContext);
      expect(result).toBe(false);
    });

    it('should return false for undefined condition', async () => {
      const result = await evaluateCondition(undefined as any, baseContext);
      expect(result).toBe(false);
    });

    it('should return false for non-object condition', async () => {
      const result = await evaluateCondition('invalid' as any, baseContext);
      expect(result).toBe(false);
    });

    it('should return false for missing condition type', async () => {
      const result = await evaluateCondition({ field: 'test' } as any, baseContext);
      expect(result).toBe(false);
    });

    it('should return false for invalid condition type', async () => {
      const result = await evaluateCondition({ type: 'invalid' } as any, baseContext);
      expect(result).toBe(false);
    });
  });

  describe('Field Conditions - eq (equal)', () => {
    it('should return true when field equals value', async () => {
      const condition = fieldCondition('subject.id', 'eq', 'user-1');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false when field does not equal value', async () => {
      const condition = fieldCondition('subject.id', 'eq', 'user-2');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return false for type mismatch', async () => {
      const condition = fieldCondition('subject.id', 'eq', 123);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should handle nested field paths', async () => {
      const context = {
        ...baseContext,
        subject: {
          ...baseContext.subject,
          profile: { department: 'engineering' },
        },
      };
      const condition = fieldCondition('subject.profile.department', 'eq', 'engineering');
      const result = await evaluateCondition(condition, context);
      expect(result).toBe(true);
    });
  });

  describe('Field Conditions - neq (not equal)', () => {
    it('should return true when field does not equal value', async () => {
      const condition = fieldCondition('subject.id', 'neq', 'user-2');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false when field equals value', async () => {
      const condition = fieldCondition('subject.id', 'neq', 'user-1');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });
  });

  describe('Field Conditions - Numeric comparisons', () => {
    it('should return true for gt (greater than)', async () => {
      const condition = fieldCondition('resource.priority', 'gt', 5);
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { priority: 10 },
      });
      expect(result).toBe(true);
    });

    it('should return false for gt when equal', async () => {
      const condition = fieldCondition('resource.priority', 'gt', 10);
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { priority: 10 },
      });
      expect(result).toBe(false);
    });

    it('should return false for gt when less', async () => {
      const condition = fieldCondition('resource.priority', 'gt', 10);
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { priority: 5 },
      });
      expect(result).toBe(false);
    });

    it('should return false for gt when types mismatch', async () => {
      const condition = fieldCondition('resource.count', 'gt', '10');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { count: 15 },
      });
      expect(result).toBe(false);
    });

    it('should return true for gte (greater than or equal)', async () => {
      const condition = fieldCondition('resource.value', 'gte', 100);
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { value: 100 },
      });
      expect(result).toBe(true);
    });

    it('should return true for lt (less than)', async () => {
      const condition = fieldCondition('resource.count', 'lt', 100);
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { count: 50 },
      });
      expect(result).toBe(true);
    });

    it('should return true for lte (less than or equal)', async () => {
      const condition = fieldCondition('resource.limit', 'lte', 100);
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { limit: 100 },
      });
      expect(result).toBe(true);
    });
  });

  describe('Field Conditions - Array operations', () => {
    it('should return true for in operator when value in array', async () => {
      const condition = fieldCondition('subject.id', 'in', ['user-1', 'user-2']);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false for in operator when value not in array', async () => {
      const condition = fieldCondition('subject.id', 'in', ['user-2', 'user-3']);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return true for notIn operator when value not in array', async () => {
      const condition = fieldCondition('subject.id', 'notIn', ['user-2', 'user-3']);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false for notIn operator when value in array', async () => {
      const condition = fieldCondition('subject.id', 'notIn', ['user-1', 'user-2']);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return false for in when expected is not array', async () => {
      const condition = fieldCondition('subject.id', 'in', 'user-1');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should check array element for in operator', async () => {
      // When checking if 'developer' is in ['admin', 'developer']
      const condition = fieldCondition('subject.roles', 'in', ['admin', 'developer']);
      const result = await evaluateCondition(condition, baseContext);
      // This returns false because ['admin', 'developer'].includes(['admin', 'developer']) is false
      // The 'in' operator checks if the actual value (array) is in the expected array
      expect(result).toBe(false);
    });

    it('should check single value for in operator', async () => {
      // Check if 'developer' is in the roles array using eq
      const condition = fieldCondition('subject.roles', 'contains', 'developer');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });
  });

  describe('Field Conditions - contains', () => {
    it('should return true when array contains value', async () => {
      const condition = fieldCondition('resource.tags', 'contains', 'urgent');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false when array does not contain value', async () => {
      const condition = fieldCondition('resource.tags', 'contains', 'deprecated');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return true when string contains substring', async () => {
      const condition = fieldCondition('resource.description', 'contains', 'important');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { description: 'This is an important resource' },
      });
      expect(result).toBe(true);
    });

    it('should return false for type mismatch in contains', async () => {
      const condition = fieldCondition('resource.count', 'contains', 5);
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { count: [1, 2, 3] },
      });
      expect(result).toBe(false);
    });
  });

  describe('Field Conditions - String operations', () => {
    it('should return true for startsWith', async () => {
      const condition = fieldCondition('resource.email', 'startsWith', 'admin');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { email: 'admin@example.com' },
      });
      expect(result).toBe(true);
    });

    it('should return false for startsWith when not matching', async () => {
      const condition = fieldCondition('resource.email', 'startsWith', 'user');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { email: 'admin@example.com' },
      });
      expect(result).toBe(false);
    });

    it('should return true for endsWith', async () => {
      const condition = fieldCondition('resource.email', 'endsWith', '.com');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { email: 'admin@example.com' },
      });
      expect(result).toBe(true);
    });

    it('should return false for endsWith when not matching', async () => {
      const condition = fieldCondition('resource.email', 'endsWith', '.org');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { email: 'admin@example.com' },
      });
      expect(result).toBe(false);
    });

    it('should return false for string ops with type mismatch', async () => {
      const condition = fieldCondition('resource.count', 'startsWith', '10');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { count: 100 },
      });
      expect(result).toBe(false);
    });
  });

  describe('Field Conditions - matches (regex)', () => {
    it('should return true for valid regex match', async () => {
      const condition = fieldCondition('resource.email', 'matches', '^\\S+@\\S+\\.\\S+$');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { email: 'test@example.com' },
      });
      expect(result).toBe(true);
    });

    it('should return false for regex non-match', async () => {
      const condition = fieldCondition('resource.email', 'matches', '^admin@');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { email: 'test@example.com' },
      });
      expect(result).toBe(false);
    });

    it('should return false for invalid regex pattern', async () => {
      const condition = fieldCondition('resource.name', 'matches', '[invalid(regex');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { name: 'test' },
      });
      expect(result).toBe(false);
    });

    it('should return false for type mismatch in matches', async () => {
      const condition = fieldCondition('resource.count', 'matches', '\\d+');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { count: 123 },
      });
      expect(result).toBe(false);
    });
  });

  describe('Field Conditions - exists/notExists', () => {
    it('should return true for exists when field is defined', async () => {
      const condition = fieldCondition('resource.id', 'exists');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false for exists when field is undefined', async () => {
      const condition = fieldCondition('resource.missing', 'exists');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return true for notExists when field is undefined', async () => {
      const condition = fieldCondition('resource.nonexistent', 'notExists');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false for notExists when field exists', async () => {
      const condition = fieldCondition('resource.id', 'notExists');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return false for exists when field is null', async () => {
      const condition = fieldCondition('resource.nullField', 'exists');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        resource: { nullField: null },
      });
      expect(result).toBe(false);
    });
  });

  describe('Field Conditions - field validation', () => {
    it('should return false for missing field', async () => {
      const condition = { type: 'field' as const, operator: 'eq', value: 'test' };
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return false for empty field', async () => {
      const condition = { type: 'field' as const, field: '', operator: 'eq', value: 'test' };
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return false for missing operator', async () => {
      const condition = { type: 'field' as const, field: 'subject.id', value: 'test' } as any;
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });
  });

  describe('Time Conditions', () => {
    it('should return false for missing operator', async () => {
      const condition = { type: 'time' as const, value: {} };
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return false for missing value', async () => {
      const condition = { type: 'time' as const, operator: 'match' };
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return false for invalid timestamp', async () => {
      const condition = { type: 'time' as const, operator: 'match', value: {} };
      const result = await evaluateCondition(condition, {
        ...baseContext,
        request: { ...baseContext.request, timestamp: 'invalid' as any },
      });
      expect(result).toBe(false);
    });

    it('should return true for valid time config without constraints', async () => {
      const condition = { type: 'time' as const, operator: 'match', value: {} };
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false for after constraint not met', async () => {
      const condition = timeCondition({ after: '2024-06-16T00:00:00Z' });
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return true for after constraint met', async () => {
      const condition = timeCondition({ after: '2024-06-01T00:00:00Z' });
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false for before constraint not met', async () => {
      const condition = timeCondition({ before: '2024-06-01T00:00:00Z' });
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return true for before constraint met', async () => {
      const condition = timeCondition({ before: '2024-06-20T00:00:00Z' });
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should check dayOfWeek constraint', async () => {
      // June 15, 2024 is Saturday (day 6)
      const condition = timeCondition({ dayOfWeek: [1, 2, 3, 4, 5] }); // Mon-Fri
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should check hourRange constraint', async () => {
      // Create a date explicitly at noon
      const timestamp = new Date(Date.UTC(2024, 5, 15, 12, 0, 0)); // June 15, 2024, 12:00 UTC
      const context = {
        ...baseContext,
        request: {
          ...baseContext.request,
          timestamp,
        },
      };
      const condition = timeCondition({ hourRange: [9, 17] });
      const result = await evaluateCondition(condition, context);
      // 12:00 UTC is noon, should be within 9-17
      expect(result).toBe(true);
    });

    it('should return false for hourRange outside range', async () => {
      // Create a date explicitly at 8 AM UTC
      const timestamp = new Date(Date.UTC(2024, 5, 15, 8, 0, 0)); // June 15, 2024, 8:00 UTC
      const context = {
        ...baseContext,
        request: {
          ...baseContext.request,
          timestamp,
        },
      };
      const condition = timeCondition({ hourRange: [9, 17] });
      const result = await evaluateCondition(condition, context);
      // 8:00 UTC is before 9 AM, should fail
      expect(result).toBe(false);
    });
  });

  describe('IP Conditions', () => {
    it('should return false for missing client IP', async () => {
      const condition = ipCondition('eq', '192.168.1.1');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        request: { ...baseContext.request, ip: null as any },
      });
      expect(result).toBe(false);
    });

    it('should return false for invalid client IP', async () => {
      const condition = ipCondition('eq', '192.168.1.1');
      const result = await evaluateCondition(condition, {
        ...baseContext,
        request: { ...baseContext.request, ip: 'invalid-ip' },
      });
      expect(result).toBe(false);
    });

    it('should return true for exact IP match', async () => {
      const condition = ipCondition('eq', '192.168.1.100');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false for IP mismatch', async () => {
      const condition = ipCondition('eq', '192.168.1.200');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return true when IP in list', async () => {
      const condition = ipCondition('in', ['192.168.1.50', '192.168.1.100', '10.0.0.1']);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false when IP not in list', async () => {
      const condition = ipCondition('in', ['192.168.1.50', '10.0.0.1']);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return false when IP in notIn list', async () => {
      const condition = ipCondition('notIn', ['192.168.1.100', '10.0.0.1']);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return true when IP not in notIn list', async () => {
      const condition = ipCondition('notIn', ['192.168.1.50', '10.0.0.1']);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should support CIDR notation', async () => {
      const condition = ipCondition('in', ['192.168.1.0/24']);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should reject IP outside CIDR range', async () => {
      const condition = ipCondition('in', ['192.168.2.0/24']);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should support wildcard notation', async () => {
      const condition = ipCondition('in', ['192.168.*.*']);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should reject invalid CIDR prefix length', async () => {
      const condition = ipCondition('in', ['192.168.1.0/33']);
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });
  });

  describe('Custom Conditions', () => {
    it('should return false for missing fn', async () => {
      const condition = { type: 'custom' as const, value: {} };
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return false for non-function fn', async () => {
      const condition = { type: 'custom' as const, fn: 'not a function' };
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should return true when custom function returns true', async () => {
      const condition = customCondition((ctx) => ctx.subject.id === 'user-1');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false when custom function returns false', async () => {
      const condition = customCondition((ctx) => ctx.subject.id === 'user-2');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });

    it('should support async custom functions', async () => {
      const condition = customCondition(async (ctx) => ctx.subject.id === 'user-1');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return false when custom function throws', async () => {
      const condition = customCondition(() => {
        throw new Error('Custom error');
      });
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });
  });

  describe('Field value resolution', () => {
    it('should resolve subject fields', async () => {
      const condition = fieldCondition('subject.type', 'eq', 'user');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should resolve tenant fields', async () => {
      const condition = fieldCondition('tenant.id', 'eq', 'tenant-1');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should resolve resource fields', async () => {
      const condition = fieldCondition('resource.status', 'eq', 'active');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should resolve request fields', async () => {
      const condition = fieldCondition('request.method', 'eq', 'GET');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should resolve environment fields', async () => {
      const condition = fieldCondition('environment.stage', 'eq', 'production');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(true);
    });

    it('should return undefined for unknown source', async () => {
      const condition = fieldCondition('unknown.field', 'eq', 'value');
      const result = await evaluateCondition(condition, baseContext);
      expect(result).toBe(false);
    });
  });

  describe('Condition factory functions', () => {
    it('fieldCondition should create correct condition object', () => {
      const condition = fieldCondition('test.field', 'eq', 'value');
      expect(condition).toEqual({
        type: 'field',
        field: 'test.field',
        operator: 'eq',
        value: 'value',
      });
    });

    it('timeCondition should create correct condition object', () => {
      const condition = timeCondition({ after: '2024-01-01', before: '2024-12-31' });
      expect(condition).toEqual({
        type: 'time',
        operator: 'match',
        value: { after: '2024-01-01', before: '2024-12-31' },
      });
    });

    it('ipCondition should create correct condition object', () => {
      const condition = ipCondition('in', ['192.168.1.0/24']);
      expect(condition).toEqual({
        type: 'ip',
        operator: 'in',
        value: ['192.168.1.0/24'],
      });
    });

    it('customCondition should create correct condition object', () => {
      const fn = () => true;
      const condition = customCondition(fn);
      expect(condition).toEqual({
        type: 'custom',
        fn,
      });
    });
  });
});
