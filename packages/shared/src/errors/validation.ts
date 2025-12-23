import type { ZodError } from "zod";
import { MTPCError } from "./base.js";

/**
 * Validation error
 */
export class ValidationError extends MTPCError {
  public readonly issues: Array<{
    path: (string | number)[];
    message: string;
  }>;

  constructor(zodError: ZodError) {
    const issues = zodError.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));

    super("Validation failed", "VALIDATION_ERROR", { issues });
    this.name = "ValidationError";
    this.issues = issues;
  }

  static fromMessage(message: string, path: string[] = []) {
    const error = new MTPCError(message, "VALIDATION_ERROR", { path });
    error.name = "ValidationError";
    return error;
  }
}
