import type { Permission, ResourceDefinition } from '@mtpc/core';

/**
 * Code generation options
 */
export interface CodegenOptions {
  outputDir: string;
  resources: ResourceDefinition[];
  permissions?: PermissionOptions;
  typescript?: TypeScriptOptions;
  metadata?: MetadataOptions;
  schema?: SchemaOptions;
}

/**
 * TypeScript generation options
 */
export interface TypeScriptOptions {
  enabled?: boolean;
  outputFile?: string;
  includeZodSchemas?: boolean;
  includeEntityTypes?: boolean;
  includeInputTypes?: boolean;
}

/**
 * Permission code generation options
 */
export interface PermissionOptions {
  enabled?: boolean;
  outputFile?: string;
  format?: 'const' | 'enum' | 'object';
  prefix?: string;
}

/**
 * Metadata generation options
 */
export interface MetadataOptions {
  enabled?: boolean;
  outputFile?: string;
  includePermissions?: boolean;
  includeFeatures?: boolean;
}

/**
 * Schema generation options
 */
export interface SchemaOptions {
  enabled?: boolean;
  outputFile?: string;
  dialect?: 'postgresql' | 'mysql' | 'sqlite';
  tenantColumn?: string;
  timestamps?: boolean;
}

/**
 * Generated file info
 */
export interface GeneratedFile {
  path: string;
  content: string;
  type: 'typescript' | 'json' | 'sql';
}

/**
 * Generation result
 */
export interface GenerationResult {
  files: GeneratedFile[];
  errors: GenerationError[];
  warnings: string[];
}

/**
 * Generation error
 */
export interface GenerationError {
  resource?: string;
  message: string;
  code: string;
}

/**
 * Template context
 */
export interface TemplateContext {
  resources: ResourceDefinition[];
  permissions: Permission[];
  options: CodegenOptions;
  timestamp: Date;
  version: string;
}
