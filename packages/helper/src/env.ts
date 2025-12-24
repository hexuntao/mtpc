import type { PolicyCondition, PolicyEvaluationContext } from '@mtpc/core';

/**
 * 简单 IP 匹配（支持等号、前缀、通配符）
 */
function matchIp(ip: string, pattern: string): boolean {
  if (ip === pattern) return true;

  // 简单 CIDR: "192.168.0." 前缀匹配
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -1); // 保留最后一个点
    return ip.startsWith(prefix);
  }

  // 通用 * 替换为任意数字段
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '\\d+') + '$');
    return regex.test(ip);
  }

  return false;
}

/**
 * 限制请求 IP 在白名单内
 */
export function ipIn(whitelist: string[]): PolicyCondition {
  const list = [...whitelist];
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const ip = ctx.request.ip;
      if (!ip) return false;
      return list.some(p => matchIp(ip, p));
    },
  } as PolicyCondition;
}

/**
 * 限制请求 IP 不在黑名单内
 */
export function ipNotIn(blacklist: string[]): PolicyCondition {
  const list = [...blacklist];
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const ip = ctx.request.ip;
      if (!ip) return true; // 没 IP 就不拦
      return !list.some(p => matchIp(ip, p));
    },
  } as PolicyCondition;
}

/**
 * User-Agent 包含指定子串
 */
export function userAgentContains(substring: string): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const ua = ctx.request.userAgent ?? '';
      return ua.includes(substring);
    },
  } as PolicyCondition;
}

/**
 * User-Agent 匹配正则
 */
export function userAgentMatches(pattern: RegExp): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const ua = ctx.request.userAgent ?? '';
      return pattern.test(ua);
    },
  } as PolicyCondition;
}
