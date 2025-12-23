import type { Permission, ResourceDefinition } from '@mtpc/core';

/**
 * 代码生成选项
 * 用于配置代码生成器的行为和输出
 */
export interface CodegenOptions {
  /** 输出目录路径 */
  outputDir: string;
  /** 资源定义列表 */
  resources: ResourceDefinition[];
  /** 权限代码生成选项 */
  permissions?: PermissionOptions;
  /** TypeScript 类型生成选项 */
  typescript?: TypeScriptOptions;
  /** 元数据生成选项 */
  metadata?: MetadataOptions;
  /** 数据库 Schema 生成选项 */
  schema?: SchemaOptions;
}

/**
 * TypeScript 类型生成选项
 */
export interface TypeScriptOptions {
  /** 是否启用 TypeScript 类型生成 */
  enabled?: boolean;
  /** 输出文件名 */
  outputFile?: string;
  /** 是否包含 Zod Schema 定义 */
  includeZodSchemas?: boolean;
  /** 是否包含实体类型 */
  includeEntityTypes?: boolean;
  /** 是否包含输入类型（Create/Update） */
  includeInputTypes?: boolean;
}

/**
 * 权限代码生成选项
 */
export interface PermissionOptions {
  /** 是否启用权限代码生成 */
  enabled?: boolean;
  /** 输出文件名 */
  outputFile?: string;
  /** 输出格式 */
  format?: 'const' | 'enum' | 'object';
  /** 权限常量名称前缀 */
  prefix?: string;
}

/**
 * 元数据生成选项
 */
export interface MetadataOptions {
  /** 是否启用元数据生成 */
  enabled?: boolean;
  /** 输出文件名 */
  outputFile?: string;
  /** 是否包含权限信息 */
  includePermissions?: boolean;
  /** 是否包含功能特性信息 */
  includeFeatures?: boolean;
}

/**
 * 数据库 Schema 生成选项
 */
export interface SchemaOptions {
  /** 是否启用 Schema 生成 */
  enabled?: boolean;
  /** 输出文件名 */
  outputFile?: string;
  /** 数据库方言 */
  dialect?: 'postgresql' | 'mysql' | 'sqlite';
  /** 租户 ID 列名 */
  tenantColumn?: string;
  /** 是否包含时间戳字段 */
  timestamps?: boolean;
}

/**
 * 生成的文件信息
 */
export interface GeneratedFile {
  /** 文件相对路径 */
  path: string;
  /** 文件内容 */
  content: string;
  /** 文件类型 */
  type: 'typescript' | 'json' | 'sql';
}

/**
 * 代码生成结果
 */
export interface GenerationResult {
  /** 生成的文件列表 */
  files: GeneratedFile[];
  /** 生成过程中的错误列表 */
  errors: GenerationError[];
  /** 警告信息列表 */
  warnings: string[];
}

/**
 * 代码生成错误
 */
export interface GenerationError {
  /** 相关的资源名称（可选） */
  resource?: string;
  /** 错误消息 */
  message: string;
  /** 错误代码 */
  code: string;
}

/**
 * 模板渲染上下文
 * 用于在模板渲染时提供数据和辅助函数
 */
export interface TemplateContext {
  /** 资源定义列表 */
  resources: ResourceDefinition[];
  /** 权限列表 */
  permissions: Permission[];
  /** 代码生成选项 */
  options: CodegenOptions;
  /** 生成时间戳 */
  timestamp: Date;
  /** 版本号 */
  version: string;
}
