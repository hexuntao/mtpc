import type {
  PolicyCondition,
  SubjectContext,
  TenantContext,
} from '@mtpc/core';

/**
 * 解释详细级别
 * - minimal: 最小化信息，仅包含基本决策和原因
 * - standard: 标准信息，包含决策、原因、匹配的策略和规则
 * - detailed: 详细信息，包含所有策略和规则的评估结果
 * - debug: 调试信息，包含完整的评估过程和上下文
 */
export type ExplainLevel = 'minimal' | 'standard' | 'detailed' | 'debug';

/**
 * 决策类型
 * - allow: 允许访问
 * - deny: 拒绝访问
 * - not_applicable: 不适用，权限代码格式错误或其他特殊情况
 */
export type DecisionType = 'allow' | 'deny' | 'not_applicable';

/**
 * 条件评估结果
 */
export interface ConditionResult {
  /** 被评估的条件 */
  condition: PolicyCondition;
  /** 条件是否通过 */
  passed: boolean;
  /** 实际值 */
  actualValue?: unknown;
  /** 期望值 */
  expectedValue?: unknown;
  /** 错误信息（如果条件评估失败） */
  error?: string;
}

/**
 * 规则评估结果
 */
export interface RuleResult {
  /** 规则索引 */
  ruleIndex: number;
  /** 规则是否匹配 */
  matched: boolean;
  /** 规则的效果 */
  effect: 'allow' | 'deny';
  /** 条件评估结果列表 */
  conditionResults: ConditionResult[];
  /** 规则描述 */
  description?: string;
}

/**
 * 策略评估结果
 */
export interface PolicyResult {
  /** 策略ID */
  policyId: string;
  /** 策略名称 */
  policyName: string;
  /** 策略是否匹配 */
  matched: boolean;
  /** 策略的效果 */
  effect?: 'allow' | 'deny';
  /** 规则评估结果列表 */
  ruleResults: RuleResult[];
  /** 策略优先级（数值越大，优先级越高） */
  priority: number;
  /** 策略是否启用 */
  enabled: boolean;
}

/**
 * 权限解释
 */
export interface PermissionExplanation {
  /** 被评估的权限 */
  permission: string;
  /** 资源名称 */
  resource: string;
  /** 操作名称 */
  action: string;
  /** 决策结果 */
  decision: DecisionType;
  /** 决策原因 */
  reason: string;
  /** 匹配的策略ID */
  matchedPolicy?: string;
  /** 匹配的规则索引 */
  matchedRule?: number;
  /** 评估路径，记录评估过程 */
  evaluationPath: string[];
  /** 评估时间戳 */
  timestamp: Date;
  /** 评估耗时（毫秒） */
  duration: number;
  /** 评估上下文 */
  context: ExplanationContext;
  /** 策略评估结果列表（可选） */
  policies?: PolicyResult[];
}

/**
 * 解释上下文
 */
export interface ExplanationContext {
  /** 租户信息 */
  tenant: {
    /** 租户ID */
    id: string;
    /** 租户状态 */
    status?: string;
  };
  /** 主体信息 */
  subject: {
    /** 主体ID */
    id: string;
    /** 主体类型 */
    type: string;
    /** 主体角色列表 */
    roles?: string[];
  };
  /** 资源信息（可选） */
  resource?: Record<string, unknown>;
  /** 环境信息（可选） */
  environment?: {
    /** 环境时间戳 */
    timestamp: Date;
    /** 请求IP地址 */
    ip?: string;
  };
}

/**
 * 解释选项
 */
export interface ExplainOptions {
  /** 解释详细级别 */
  level?: ExplainLevel;
  /** 是否包含策略评估结果 */
  includePolicies?: boolean;
  /** 是否包含条件评估结果 */
  includeConditions?: boolean;
  /** 是否包含上下文信息 */
  includeContext?: boolean;
  /** 最大返回的策略数量 */
  maxPolicies?: number;
}

/**
 * 批量解释请求
 */
export interface BulkExplainRequest {
  /** 租户上下文 */
  tenant: TenantContext;
  /** 主体上下文 */
  subject: SubjectContext;
  /** 权限列表 */
  permissions: string[];
  /** 解释选项 */
  options?: ExplainOptions;
}

/**
 * 批量解释结果
 */
export interface BulkExplainResult {
  /** 权限解释列表 */
  explanations: PermissionExplanation[];
  /** 解释摘要 */
  summary: {
    /** 总解释数量 */
    total: number;
    /** 允许的解释数量 */
    allowed: number;
    /** 拒绝的解释数量 */
    denied: number;
    /** 不适用的解释数量 */
    notApplicable: number;
  };
  /** 总耗时（毫秒） */
  duration: number;
}

/**
 * 解释格式化器
 * 用于将权限解释结果格式化为不同的输出格式
 */
export interface ExplanationFormatter {
  /**
   * 格式化单个权限解释
   * @param explanation 权限解释
   * @returns 格式化后的字符串
   */
  format(explanation: PermissionExplanation): string;
  /**
   * 格式化批量权限解释结果
   * @param result 批量解释结果
   * @returns 格式化后的字符串
   */
  formatBulk(result: BulkExplainResult): string;
}
