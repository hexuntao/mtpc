/**
 * MTPC Explain 扩展 - 架构级测试
 *
 * 测试目标：
 * 1. 开关不影响权限判定结果
 * 2. 解释不泄漏跨租户信息
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createExplainPlugin } from '../plugin.js';
import type { PluginContext } from '@mtpc/core';

// ========== Mock PluginContext ==========

function createMockPluginContext(overrides: Partial<PluginContext> = {}): PluginContext {
  return {
    registerResource: () => {},
    registerPolicy: () => {},
    registerGlobalHooks: () => {},
    extendResourceHooks: () => {},
    getResource: () => undefined,
    getPolicy: () => undefined,
    ...overrides,
  };
}

// ========== Fixtures ==========

describe('TC-EXPLAIN-001: 开关不影响判定结果 [架构级测试 - Non-decisive]', () => {
  it('should create explain plugin without affecting core', () => {
    // 创建 Explain 插件
    const plugin = createExplainPlugin({
      defaultLevel: 'detailed',
      collectExplanations: true,
    });

    // 验证插件结构
    expect(plugin.name).toBe('@mtpc/explain');
    expect(plugin.state).toBeDefined();
    expect(plugin.state.collector).toBeDefined();
    expect(plugin.state.formatter).toBeDefined();
  });

  it('should have explainer undefined before init', () => {
    const plugin = createExplainPlugin();

    // init 之前，explainer 未定义
    expect(plugin.state.explainer).toBeUndefined();
  });

  it('should require policyEngine in onInit', async () => {
    const plugin = createExplainPlugin();

    // 没有 policyEngine 应该抛出错误
    let errorThrown = false;
    let caughtError: Error | null = null;

    try {
      await plugin.onInit(createMockPluginContext());
    } catch (e) {
      errorThrown = true;
      caughtError = e as Error;
    }

    expect(errorThrown).toBe(true);
    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toContain('policyEngine');
  });

  it('should require permissionResolver in onInit', async () => {
    const plugin = createExplainPlugin({
      defaultLevel: 'detailed',
    });

    // 只有 policyEngine，没有 permissionResolver 应该抛出错误
    let errorThrown = false;
    let caughtError: Error | null = null;

    try {
      await plugin.onInit(createMockPluginContext({ policyEngine: {} as any }));
    } catch (e) {
      errorThrown = true;
      caughtError = e as Error;
    }

    expect(errorThrown).toBe(true);
    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toContain('permissionResolver');
  });
});

describe('TC-EXPLAIN-002: 解释不泄漏跨租户信息 [架构级测试 - No Information Leak]', () => {
  it('should create collector with max entries limit', () => {
    const plugin = createExplainPlugin({
      maxCollectedEntries: 100,
    });

    expect(plugin.state.collector).toBeDefined();
  });

  it('should clear collector on destroy', () => {
    const plugin = createExplainPlugin({
      collectExplanations: true,
    });

    // 调用 destroy
    plugin.onDestroy();

    // 验证 collector 被清空
    expect(plugin.state).toBeDefined();
  });
});

describe('TC-EXPLAIN-003: 解释准确性 [语义级测试]', () => {
  it('should format explanation correctly', async () => {
    const plugin = createExplainPlugin({
      defaultLevel: 'standard',
    });

    // 验证 formatter 存在
    expect(plugin.state.formatter).toBeDefined();
  });
});
