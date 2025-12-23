import type {
  PolicyCondition,
  PolicyConditionType,
  PolicyEvaluationContext,
} from '../types/index.js';
import { getByPath } from '@mtpc/shared';

/**
 * Evaluate a single condition
 */
export async function evaluateCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): Promise<boolean> {
  switch (condition.type) {
    case 'field':
      return evaluateFieldCondition(condition, context);
    case 'time':
      return evaluateTimeCondition(condition, context);
    case 'ip':
      return evaluateIpCondition(condition, context);
    case 'custom':
      return evaluateCustomCondition(condition, context);
    default:
      return false;
  }
}

/**
 * Evaluate field condition
 */
function evaluateFieldCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): boolean {
  if (!condition.field || !condition.operator) {
    return false;
  }

  // Resolve field value from context
  const fieldValue = resolveFieldValue(condition.field, context);
  const compareValue = condition.value;

  return compareValues(fieldValue, condition.operator, compareValue);
}

/**
 * Resolve field value from context
 */
function resolveFieldValue(
  field: string,
  context: PolicyEvaluationContext
): unknown {
  // Support dotted paths like "subject.roles", "resource.status"
  const [source, ...pathParts] = field.split('.');
  const path = pathParts.join('.');

  let sourceObj: unknown;

  switch (source) {
    case 'subject':
      sourceObj = context.subject;
      break;
    case 'tenant':
      sourceObj = context.tenant;
      break;
    case 'resource':
      sourceObj = context.resource;
      break;
    case 'request':
      sourceObj = context.request;
      break;
    case 'environment':
      sourceObj = context.environment;
      break;
    default:
      return undefined;
  }

  if (!path) {
    return sourceObj;
  }

  return getByPath(sourceObj as Record<string, unknown>, path);
}

/**
 * Compare values based on operator
 */
function compareValues(
  actual: unknown,
  operator: string,
  expected: unknown
): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'gt':
      return (actual as number) > (expected as number);
    case 'gte':
      return (actual as number) >= (expected as number);
    case 'lt':
      return (actual as number) < (expected as number);
    case 'lte':
      return (actual as number) <= (expected as number);
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'notIn':
      return Array.isArray(expected) && !expected.includes(actual);
    case 'contains':
      if (Array.isArray(actual)) {
        return actual.includes(expected);
      }
      if (typeof actual === 'string') {
        return actual.includes(expected as string);
      }
      return false;
    case 'startsWith':
      return typeof actual === 'string' && actual.startsWith(expected as string);
    case 'endsWith':
      return typeof actual === 'string' && actual.endsWith(expected as string);
    case 'matches':
      return typeof actual === 'string' && new RegExp(expected as string).test(actual);
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'notExists':
      return actual === undefined || actual === null;
    default:
      return false;
  }
}

/**
 * Evaluate time condition
 */
function evaluateTimeCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): boolean {
  const now = context.request.timestamp;
  const { operator, value } = condition;

  if (!operator || !value) {
    return false;
  }

  if (typeof value === 'object' && value !== null) {
    const timeConfig = value as {
      after?: string;
      before?: string;
      dayOfWeek?: number[];
      hourRange?: [number, number];
    };

    // Check after/before
    if (timeConfig.after && now < new Date(timeConfig.after)) {
      return false;
    }
    if (timeConfig.before && now > new Date(timeConfig.before)) {
      return false;
    }

    // Check day of week
    if (timeConfig.dayOfWeek && !timeConfig.dayOfWeek.includes(now.getDay())) {
      return false;
    }

    // Check hour range
    if (timeConfig.hourRange) {
      const hour = now.getHours();
      if (hour < timeConfig.hourRange[0] || hour > timeConfig.hourRange[1]) {
        return false;
      }
    }

    return true;
  }

  return false;
}

/**
 * Evaluate IP condition
 */
function evaluateIpCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): boolean {
  const clientIp = context.request.ip;
  
  if (!clientIp || !condition.value) {
    return false;
  }

  const { operator, value } = condition;

  if (operator === 'in' && Array.isArray(value)) {
    return value.some(pattern => matchIp(clientIp, pattern as string));
  }

  if (operator === 'notIn' && Array.isArray(value)) {
    return !value.some(pattern => matchIp(clientIp, pattern as string));
  }

  if (operator === 'eq') {
    return matchIp(clientIp, value as string);
  }

  return false;
}

/**
 * Match IP against pattern (simple implementation)
 */
function matchIp(ip: string, pattern: string): boolean {
  // Exact match
  if (ip === pattern) {
    return true;
  }

  // CIDR notation (simplified)
  if (pattern.includes('/')) {
    // For production, use a proper IP matching library
    const [network] = pattern.split('/');
    return ip.startsWith(network.split('.').slice(0, -1).join('.'));
  }

  // Wildcard
  if (pattern.includes('*')) {
    const regex = new RegExp(
      '^' + pattern.replace(/./g, '\.').replace(/*/g, '\d+') + '$'
    );
    return regex.test(ip);
  }

  return false;
}

/**
 * Evaluate custom condition
 */
async function evaluateCustomCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): Promise<boolean> {
  if (!condition.fn) {
    return false;
  }

  try {
    const result = await condition.fn(context);
    return result;
  } catch {
    return false;
  }
}

/**
 * Create a field condition
 */
export function fieldCondition(
  field: string,
  operator: string,
  value: unknown
): PolicyCondition {
  return { type: 'field', field, operator, value };
}

/**
 * Create a time condition
 */
export function timeCondition(
  config: {
    after?: string;
    before?: string;
    dayOfWeek?: number[];
    hourRange?: [number, number];
  }
): PolicyCondition {
  return { type: 'time', operator: 'match', value: config };
}

/**
 * Create an IP condition
 */
export function ipCondition(
  operator: 'in' | 'notIn' | 'eq',
  value: string | string[]
): PolicyCondition {
  return { type: 'ip', operator, value };
}

/**
 * Create a custom condition
 */
export function customCondition(
  fn: (context: PolicyEvaluationContext) => boolean | Promise<boolean>
): PolicyCondition {
  return { type: 'custom', fn };
}
