import type { PluginContext, PluginDefinition, PolicyEngine } from '@mtpc/core';
import { ExplanationCollector } from './collector.js';
import type { PermissionExplainer } from './explainer.js';
import { TextFormatter } from './formatter.js';
import type { ExplainLevel } from './types.js';

/**
 * Explain plugin options
 */
export interface ExplainPluginOptions {
  defaultLevel?: ExplainLevel;
  collectExplanations?: boolean;
  maxCollectedEntries?: number;
}

/**
 * Explain plugin state
 */
export interface ExplainPluginState {
  explainer?: PermissionExplainer;
  collector: ExplanationCollector;
  formatter: TextFormatter;
}

/**
 * Create explain plugin
 */
export function createExplainPlugin(
  options: ExplainPluginOptions = {}
): PluginDefinition & { state: ExplainPluginState } {
  const collector = new ExplanationCollector({
    maxEntries: options.maxCollectedEntries ?? 1000,
  });
  const formatter = new TextFormatter();

  const state: ExplainPluginState = {
    collector,
    formatter,
  };

  return {
    name: '@mtpc/explain',
    version: '0.1.0',
    description: 'Permission decision explanation extension for MTPC',

    state,

    install(context: PluginContext): void {
      // Plugin installation logic
      console.log('Explain plugin installed');
    },

    onInit(context: PluginContext): void {
      console.log('Explain plugin initialized');
    },

    onDestroy(): void {
      collector.clear();
    },
  };
}
