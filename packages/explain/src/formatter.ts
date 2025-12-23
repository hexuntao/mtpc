import type {
  BulkExplainResult,
  ExplanationFormatter,
  PermissionExplanation,
  PolicyResult,
} from './types.js';

/**
 * 文本格式化器
 * 将权限解释结果格式化为易读的纯文本格式
 *
 * 特性：
 * - 支持自定义缩进
 * - 支持颜色输出（ANSI 颜色代码）
 * - 分层次展示权限检查结果
 * - 适用于终端输出和日志记录
 */
export class TextFormatter implements ExplanationFormatter {
  /** 缩进字符串，用于层级显示 */
  private indent: string;
  /** 是否使用颜色输出 */
  private useColors: boolean;

  /**
   * 创建文本格式化器实例
   * @param options 格式化选项
   * @param options.indent 缩进字符串，默认两个空格
   * @param options.useColors 是否使用颜色，默认 false
   */
  constructor(options: { indent?: string; useColors?: boolean } = {}) {
    this.indent = options.indent ?? '  ';
    this.useColors = options.useColors ?? false;
  }

  /**
   * 格式化单个权限解释
   * @param explanation 权限解释结果
   * @returns 格式化后的文本字符串
   */
  format(explanation: PermissionExplanation): string {
    const lines: string[] = [];

    // 标题
    lines.push(this.formatHeader(explanation));
    lines.push('');

    // 决策结果
    lines.push(`Decision: ${this.formatDecision(explanation.decision)}`);
    lines.push(`Reason: ${explanation.reason}`);
    lines.push('');

    // 上下文信息
    lines.push('Context:');
    lines.push(`${this.indent}Tenant: ${explanation.context.tenant.id}`);
    lines.push(
      `${this.indent}Subject: ${explanation.context.subject.id} (${explanation.context.subject.type})`
    );

    // 角色信息（如果有）
    if (explanation.context.subject.roles?.length) {
      lines.push(`${this.indent}Roles: ${explanation.context.subject.roles.join(', ')}`);
    }
    lines.push('');

    // 评估路径（如果有）
    if (explanation.evaluationPath.length > 0) {
      lines.push('Evaluation Path:');
      for (const step of explanation.evaluationPath) {
        lines.push(`${this.indent}→ ${step}`);
      }
      lines.push('');
    }

    // 策略详情（如果有）
    if (explanation.policies?.length) {
      lines.push('Policies Evaluated:');
      for (const policy of explanation.policies) {
        lines.push(this.formatPolicy(policy));
      }
      lines.push('');
    }

    // 页脚信息
    lines.push(`Duration: ${explanation.duration}ms`);
    lines.push(`Timestamp: ${explanation.timestamp.toISOString()}`);

    return lines.join('\n');
  }

  /**
   * 格式化批量权限解释结果
   * @param result 批量解释结果
   * @returns 格式化后的文本字符串
   */
  formatBulk(result: BulkExplainResult): string {
    const lines: string[] = [];

    // 摘要统计
    lines.push('=== Permission Check Summary ===');
    lines.push(`Total: ${result.summary.total}`);
    lines.push(`Allowed: ${result.summary.allowed}`);
    lines.push(`Denied: ${result.summary.denied}`);
    lines.push(`Not Applicable: ${result.summary.notApplicable}`);
    lines.push(`Duration: ${result.duration}ms`);
    lines.push('');

    // 单个结果
    lines.push('=== Individual Results ===');
    for (const explanation of result.explanations) {
      lines.push('');
      lines.push(this.formatCompact(explanation));
    }

    return lines.join('\n');
  }

  /**
   * 格式化标题
   * @param explanation 权限解释结果
   * @returns 格式化后的标题字符串
   */
  private formatHeader(explanation: PermissionExplanation): string {
    return `=== Permission: ${explanation.permission} ===`;
  }

  /**
   * 格式化决策结果（带颜色）
   * @param decision 决策类型
   * @returns 格式化后的决策字符串
   */
  private formatDecision(decision: string): string {
    // 不使用颜色，直接返回大写的决策结果
    if (!this.useColors) {
      return decision.toUpperCase();
    }

    // 使用 ANSI 颜色代码
    switch (decision) {
      case 'allow':
        return `\x1b[32m${decision.toUpperCase()}\x1b[0m`; // 绿色
      case 'deny':
        return `\x1b[31m${decision.toUpperCase()}\x1b[0m`; // 红色
      default:
        return `\x1b[33m${decision.toUpperCase()}\x1b[0m`; // 黄色
    }
  }

  /**
   * 格式化策略结果
   * @param policy 策略评估结果
   * @returns 格式化后的策略字符串
   */
  private formatPolicy(policy: PolicyResult): string {
    const status = policy.matched ? '✓' : '✗';
    const enabled = policy.enabled ? '' : ' (disabled)';
    return `${this.indent}${status} ${policy.policyName} [priority: ${policy.priority}]${enabled}`;
  }

  /**
   * 格式化为紧凑格式（单行）
   * @param explanation 权限解释结果
   * @returns 紧凑格式的字符串
   */
  private formatCompact(explanation: PermissionExplanation): string {
    const icon = explanation.decision === 'allow' ? '✓' : '✗';
    return `${icon} ${explanation.permission}: ${explanation.reason}`;
  }
}

/**
 * JSON 格式化器
 * 将权限解释结果格式化为 JSON 格式
 *
 * 特性：
 * - 支持美化输出（pretty print）
 * - 适用于 API 响应和数据存储
 * - 易于程序化处理
 */
export class JSONFormatter implements ExplanationFormatter {
  /** 是否美化输出（添加缩进和换行） */
  private pretty: boolean;

  /**
   * 创建 JSON 格式化器实例
   * @param options 格式化选项
   * @param options.pretty 是否美化输出，默认 true
   */
  constructor(options: { pretty?: boolean } = {}) {
    this.pretty = options.pretty ?? true;
  }

  /**
   * 格式化单个权限解释
   * @param explanation 权限解释结果
   * @returns JSON 字符串
   */
  format(explanation: PermissionExplanation): string {
    const obj = this.toSerializable(explanation);
    return this.pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  }

  /**
   * 格式化批量权限解释结果
   * @param result 批量解释结果
   * @returns JSON 字符串
   */
  formatBulk(result: BulkExplainResult): string {
    const obj = {
      summary: result.summary,
      duration: result.duration,
      explanations: result.explanations.map(e => this.toSerializable(e)),
    };
    return this.pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  }

  /**
   * 将权限解释转换为可序列化的对象
   * @param explanation 权限解释结果
   * @returns 可序列化的对象
   */
  private toSerializable(explanation: PermissionExplanation): Record<string, unknown> {
    return {
      permission: explanation.permission,
      resource: explanation.resource,
      action: explanation.action,
      decision: explanation.decision,
      reason: explanation.reason,
      matchedPolicy: explanation.matchedPolicy,
      matchedRule: explanation.matchedRule,
      evaluationPath: explanation.evaluationPath,
      timestamp: explanation.timestamp.toISOString(),
      duration: explanation.duration,
      context: explanation.context,
      policies: explanation.policies?.map(p => ({
        id: p.policyId,
        name: p.policyName,
        matched: p.matched,
        effect: p.effect,
        priority: p.priority,
        enabled: p.enabled,
      })),
    };
  }
}

/**
 * Markdown 格式化器
 * 将权限解释结果格式化为 Markdown 格式
 *
 * 特性：
 * - 使用 Markdown 表格和标题
 * - 支持 emoji 图标
 * - 适用于文档和 Wiki
 * - 易于阅读和分享
 */
export class MarkdownFormatter implements ExplanationFormatter {
  /**
   * 格式化单个权限解释
   * @param explanation 权限解释结果
   * @returns Markdown 字符串
   */
  format(explanation: PermissionExplanation): string {
    const lines: string[] = [];

    // 一级标题
    lines.push(`# Permission Check: ${explanation.permission}`);
    lines.push('');

    // 决策徽章
    const badge = explanation.decision === 'allow' ? '✅ ALLOWED' : '❌ DENIED';
    lines.push(`**Decision:** ${badge}`);
    lines.push('');

    // 详细信息表格
    lines.push('## Details');
    lines.push('');
    lines.push(`| Property | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Permission | ${explanation.permission} |`);
    lines.push(`| Resource | ${explanation.resource} |`);
    lines.push(`| Action | ${explanation.action} |`);
    lines.push(`| Reason | ${explanation.reason} |`);
    lines.push('');

    // 上下文信息
    lines.push('## Context');
    lines.push('');
    lines.push(`- **Tenant:** ${explanation.context.tenant.id}`);
    lines.push(`- **Subject:** ${explanation.context.subject.id}`);
    lines.push(`- **Type:** ${explanation.context.subject.type}`);

    // 角色信息（如果有）
    if (explanation.context.subject.roles?.length) {
      lines.push(`- **Roles:** ${explanation.context.subject.roles.join(', ')}`);
    }
    lines.push('');

    // 评估路径（如果有）
    if (explanation.evaluationPath.length > 0) {
      lines.push('## Evaluation Path');
      lines.push('');
      lines.push(`\`\`\``);
      for (const step of explanation.evaluationPath) {
        lines.push(step);
      }
      lines.push(`\`\`\``);
      lines.push('');
    }

    // 页脚
    lines.push('---');
    lines.push(
      `*Generated at ${explanation.timestamp.toISOString()} in ${explanation.duration}ms*`
    );

    return lines.join('\n');
  }

  /**
   * 格式化批量权限解释结果
   * @param result 批量解释结果
   * @returns Markdown 字符串
   */
  formatBulk(result: BulkExplainResult): string {
    const lines: string[] = [];

    // 一级标题
    lines.push('# Permission Check Results');
    lines.push('');

    // 摘要表格
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Count |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Total | ${result.summary.total} |`);
    lines.push(`| Allowed | ${result.summary.allowed} |`);
    lines.push(`| Denied | ${result.summary.denied} |`);
    lines.push(`| Duration | ${result.duration}ms |`);
    lines.push('');

    // 结果表格
    lines.push('## Results');
    lines.push('');
    lines.push(`| Permission | Decision | Reason |`);
    lines.push(`| --- | --- | --- |`);

    for (const e of result.explanations) {
      const icon = e.decision === 'allow' ? '✅' : '❌';
      lines.push(`| ${e.permission} | ${icon} | ${e.reason} |`);
    }

    return lines.join('\n');
  }
}

/**
 * 创建文本格式化器实例
 * 便捷函数，用于创建带默认配置的文本格式化器
 *
 * @param options 格式化选项
 * @param options.indent 缩进字符串
 * @param options.useColors 是否使用颜色
 * @returns 文本格式化器实例
 *
 * @example
 * ```typescript
 * const formatter = createTextFormatter({ useColors: true });
 * const text = formatter.format(explanation);
 * console.log(text);
 * ```
 */
export function createTextFormatter(options?: {
  indent?: string;
  useColors?: boolean;
}): TextFormatter {
  return new TextFormatter(options);
}

/**
 * 创建 JSON 格式化器实例
 * 便捷函数，用于创建带默认配置的 JSON 格式化器
 *
 * @param options 格式化选项
 * @param options.pretty 是否美化输出
 * @returns JSON 格式化器实例
 *
 * @example
 * ```typescript
 * const formatter = createJSONFormatter({ pretty: true });
 * const json = formatter.format(explanation);
 * console.log(json);
 * ```
 */
export function createJSONFormatter(options?: { pretty?: boolean }): JSONFormatter {
  return new JSONFormatter(options);
}

/**
 * 创建 Markdown 格式化器实例
 * 便捷函数，用于创建 Markdown 格式化器
 *
 * @returns Markdown 格式化器实例
 *
 * @example
 * ```typescript
 * const formatter = createMarkdownFormatter();
 * const markdown = formatter.format(explanation);
 * console.log(markdown);
 * ```
 */
export function createMarkdownFormatter(): MarkdownFormatter {
  return new MarkdownFormatter();
}
