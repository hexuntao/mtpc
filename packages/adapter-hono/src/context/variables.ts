import type { MTPC, MTPCContext, SubjectContext, TenantContext } from '@mtpc/core';

/**
 * Hono context variables for MTPC
 */
export interface MTPCVariables {
  tenant: TenantContext;
  subject: SubjectContext;
  mtpcContext: MTPCContext;
  mtpc: MTPC;
}

/**
 * Extended Hono env with MTPC variables
 */
export interface MTPCEnv {
  Variables: MTPCVariables;
}
