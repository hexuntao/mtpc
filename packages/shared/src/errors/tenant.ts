import { MTPCError } from "./base.js";

/**
 * Tenant not found error
 */
export class TenantNotFoundError extends MTPCError {
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`, "TENANT_NOT_FOUND", { tenantId });
    this.name = "TenantNotFoundError";
  }
}

/**
 * Missing tenant context error
 */
export class MissingTenantContextError extends MTPCError {
  constructor() {
    super("Tenant context is required but not provided", "MISSING_TENANT_CONTEXT");
    this.name = "MissingTenantContextError";
  }
}

/**
 * Invalid tenant error
 */
export class InvalidTenantError extends MTPCError {
  constructor(reason: string) {
    super(`Invalid tenant: ${reason}`, "INVALID_TENANT", { reason });
    this.name = "InvalidTenantError";
  }
}
