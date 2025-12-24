import type { MTPCContext, ResourceHooks } from '@mtpc/core';

/**
 * Versioning configuration
 */
export interface VersioningConfig {
  resourceName: string;
  /**
   * Version field in resource schema, e.g. "version"
   */
  versionField?: string;
}

/**
 * Version conflict error (optimistic locking)
 */
export class VersionConflictError extends Error {
  readonly expected: number | undefined;
  readonly actual: number | undefined;

  constructor(message: string, expected?: number, actual?: number) {
    super(message);
    this.name = 'VersionConflictError';
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Plugin state
 */
export interface VersioningPluginState {
  configs: Map<string, VersioningConfig>;
}
