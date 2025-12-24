import type { PolicyCondition, PolicyEvaluationContext } from '@mtpc/core';

/**
 * 限制在每天某个小时区间内
 */
export function withinHours(startHour: number, endHour: number): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const now = ctx.request.timestamp ?? new Date();
      const hour = now.getHours();
      // [start, end)
      return hour >= startHour && hour < endHour;
    },
  } as PolicyCondition;
}

/**
 * 限制在某个日期范围内
 */
export function betweenDates(from: Date, to: Date): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const now = ctx.request.timestamp ?? new Date();
      return now >= from && now <= to;
    },
  } as PolicyCondition;
}

/**
 * 限制在工作日（周一到周五）
 */
export function weekdaysOnly(): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const now = ctx.request.timestamp ?? new Date();
      const day = now.getDay(); // 0=Sunday, 1=Monday...
      return day >= 1 && day <= 5;
    },
  } as PolicyCondition;
}
