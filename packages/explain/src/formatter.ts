import type {
  BulkExplainResult,
  ExplanationFormatter,
  PermissionExplanation,
  PolicyResult,
} from './types.js';

/**
 * Text formatter for explanations
 */
export class TextFormatter implements ExplanationFormatter {
  private indent: string;
  private useColors: boolean;

  constructor(options: { indent?: string; useColors?: boolean } = {}) {
    this.indent = options.indent ?? '  ';
    this.useColors = options.useColors ?? false;
  }

  format(explanation: PermissionExplanation): string {
    const lines: string[] = [];

    // Header
    lines.push(this.formatHeader(explanation));
    lines.push('');

    // Decision
    lines.push(`Decision: ${this.formatDecision(explanation.decision)}`);
    lines.push(`Reason: ${explanation.reason}`);
    lines.push('');

    // Context
    lines.push('Context:');
    lines.push(`${this.indent}Tenant: ${explanation.context.tenant.id}`);
    lines.push(
      `${this.indent}Subject: ${explanation.context.subject.id} (${explanation.context.subject.type})`
    );

    if (explanation.context.subject.roles?.length) {
      lines.push(`${this.indent}Roles: ${explanation.context.subject.roles.join(', ')}`);
    }
    lines.push('');

    // Evaluation path
    if (explanation.evaluationPath.length > 0) {
      lines.push('Evaluation Path:');
      for (const step of explanation.evaluationPath) {
        lines.push(`${this.indent}→ ${step}`);
      }
      lines.push('');
    }

    // Policy details
    if (explanation.policies?.length) {
      lines.push('Policies Evaluated:');
      for (const policy of explanation.policies) {
        lines.push(this.formatPolicy(policy));
      }
      lines.push('');
    }

    // Footer
    lines.push(`Duration: ${explanation.duration}ms`);
    lines.push(`Timestamp: ${explanation.timestamp.toISOString()}`);

    return lines.join('\n');
  }

  formatBulk(result: BulkExplainResult): string {
    const lines: string[] = [];

    // Summary
    lines.push('=== Permission Check Summary ===');
    lines.push(`Total: ${result.summary.total}`);
    lines.push(`Allowed: ${result.summary.allowed}`);
    lines.push(`Denied: ${result.summary.denied}`);
    lines.push(`Not Applicable: ${result.summary.notApplicable}`);
    lines.push(`Duration: ${result.duration}ms`);
    lines.push('');

    // Individual results
    lines.push('=== Individual Results ===');
    for (const explanation of result.explanations) {
      lines.push('');
      lines.push(this.formatCompact(explanation));
    }

    return lines.join('\n');
  }

  private formatHeader(explanation: PermissionExplanation): string {
    return `=== Permission: ${explanation.permission} ===`;
  }

  private formatDecision(decision: string): string {
    if (!this.useColors) {
      return decision.toUpperCase();
    }

    switch (decision) {
      case 'allow':
        return `\x1b[32m${decision.toUpperCase()}\x1b[0m`;
      case 'deny':
        return `\x1b[31m${decision.toUpperCase()}\x1b[0m`;
      default:
        return `\x1b[33m${decision.toUpperCase()}\x1b[0m`;
    }
  }

  private formatPolicy(policy: PolicyResult): string {
    const status = policy.matched ? '✓' : '✗';
    const enabled = policy.enabled ? '' : ' (disabled)';
    return `${this.indent}${status} ${policy.policyName} [priority: ${policy.priority}]${enabled}`;
  }

  private formatCompact(explanation: PermissionExplanation): string {
    const icon = explanation.decision === 'allow' ? '✓' : '✗';
    return `${icon} ${explanation.permission}: ${explanation.reason}`;
  }
}

/**
 * JSON formatter for explanations
 */
export class JSONFormatter implements ExplanationFormatter {
  private pretty: boolean;

  constructor(options: { pretty?: boolean } = {}) {
    this.pretty = options.pretty ?? true;
  }

  format(explanation: PermissionExplanation): string {
    const obj = this.toSerializable(explanation);
    return this.pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  }

  formatBulk(result: BulkExplainResult): string {
    const obj = {
      summary: result.summary,
      duration: result.duration,
      explanations: result.explanations.map(e => this.toSerializable(e)),
    };
    return this.pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  }

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
 * Markdown formatter for explanations
 */
export class MarkdownFormatter implements ExplanationFormatter {
  format(explanation: PermissionExplanation): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Permission Check: ${explanation.permission}`);
    lines.push('');

    // Decision badge
    const badge = explanation.decision === 'allow' ? '✅ ALLOWED' : '❌ DENIED';
    lines.push(`**Decision:** ${badge}`);
    lines.push('');

    // Details
    lines.push('## Details');
    lines.push('');
    lines.push(`| Property | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Permission | ${explanation.permission} |`);
    lines.push(`| Resource | ${explanation.resource} |`);
    lines.push(`| Action | ${explanation.action} |`);
    lines.push(`| Reason | ${explanation.reason} |`);
    lines.push('');

    // Context
    lines.push('## Context');
    lines.push('');
    lines.push(`- **Tenant:** ${explanation.context.tenant.id}`);
    lines.push(`- **Subject:** ${explanation.context.subject.id}`);
    lines.push(`- **Type:** ${explanation.context.subject.type}`);

    if (explanation.context.subject.roles?.length) {
      lines.push(`- **Roles:** ${explanation.context.subject.roles.join(', ')}`);
    }
    lines.push('');

    // Evaluation path
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

    // Footer
    lines.push('---');
    lines.push(
      `*Generated at ${explanation.timestamp.toISOString()} in ${explanation.duration}ms*`
    );

    return lines.join('\n');
  }

  formatBulk(result: BulkExplainResult): string {
    const lines: string[] = [];

    // Summary
    lines.push('# Permission Check Results');
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Count |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Total | ${result.summary.total} |`);
    lines.push(`| Allowed | ${result.summary.allowed} |`);
    lines.push(`| Denied | ${result.summary.denied} |`);
    lines.push(`| Duration | ${result.duration}ms |`);
    lines.push('');

    // Results table
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
 * Create text formatter
 */
export function createTextFormatter(options?: {
  indent?: string;
  useColors?: boolean;
}): TextFormatter {
  return new TextFormatter(options);
}

/**
 * Create JSON formatter
 */
export function createJSONFormatter(options?: { pretty?: boolean }): JSONFormatter {
  return new JSONFormatter(options);
}

/**
 * Create markdown formatter
 */
export function createMarkdownFormatter(): MarkdownFormatter {
  return new MarkdownFormatter();
}
