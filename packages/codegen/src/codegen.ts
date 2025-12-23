import type { ResourceDefinition } from '@mtpc/core';
import { generateMetadata, generateMetadataTS } from './generators/metadata-generator.js';
import {
  generatePermissionCodes,
  generatePermissionTypes,
} from './generators/permission-generator.js';
import { generateDrizzleSchema, generateSQLSchema } from './generators/schema-generator.js';
import { generateTypeScriptTypes, generateTypesIndex } from './generators/typescript-generator.js';
import type { CodegenOptions, GeneratedFile, GenerationResult } from './types.js';
import { FileWriter } from './writers/file-writer.js';

/**
 * 代码生成器类
 * 负责从资源定义生成各类代码文件
 *
 * **功能**：
 * - 生成权限代码常量和类型
 * - 生成 TypeScript 类型定义
 * - 生成资源元数据
 * - 生成数据库 Schema（Drizzle ORM 和 SQL）
 *
 * **示例**：
 * ```typescript
 * const codegen = new Codegen({
 *   outputDir: './generated',
 *   resources: [userResource, postResource],
 *   permissions: { format: 'const' },
 *   typescript: { includeZodSchemas: true },
 * });
 *
 * const result = await codegen.generateAndWrite();
 * console.log(`Generated ${result.files.length} files`);
 * ```
 */
export class Codegen {
  /** 资源定义列表 */
  private resources: ResourceDefinition[];
  /** 代码生成选项 */
  private options: CodegenOptions;

  /**
   * 创建代码生成器实例
   * @param options 代码生成选项
   */
  constructor(options: CodegenOptions) {
    this.resources = options.resources;
    this.options = options;
  }

  /**
   * 生成所有代码
   * 根据配置选项生成权限代码、TypeScript 类型、元数据和数据库 Schema
   *
   * @returns 生成结果，包含文件列表、错误和警告
   *
   * **生成顺序**：
   * 1. 权限代码（permissions.ts）
   * 2. 权限类型（permission-types.ts）
   * 3. TypeScript 类型（types.ts）
   * 4. 元数据 JSON（metadata.json）
   * 5. 元数据 TypeScript（metadata.ts）
   * 6. Drizzle Schema（schema.ts）
   * 7. SQL Schema（schema.sql）
   * 8. 索引文件（index.ts）
   */
  generate(): GenerationResult {
    const files: GeneratedFile[] = [];
    const errors: Array<{ resource?: string; message: string; code: string }> = [];
    const warnings: string[] = [];

    try {
      // 生成权限代码
      if (this.options.permissions?.enabled !== false) {
        const permFile = generatePermissionCodes(this.resources, this.options.permissions);
        files.push(permFile);

        const permTypesFile = generatePermissionTypes(this.resources);
        files.push(permTypesFile);
      }

      // 生成 TypeScript 类型
      if (this.options.typescript?.enabled !== false) {
        const typesFile = generateTypeScriptTypes(this.resources, this.options.typescript);
        files.push(typesFile);
      }

      // 生成元数据
      if (this.options.metadata?.enabled !== false) {
        const metadataFile = generateMetadataTS(this.resources, this.options.metadata);
        files.push(metadataFile);

        const metadataJsonFile = generateMetadata(this.resources, this.options.metadata);
        files.push(metadataJsonFile);
      }

      // 生成数据库 Schema
      if (this.options.schema?.enabled) {
        const schemaFile = generateDrizzleSchema(this.resources, this.options.schema);
        files.push(schemaFile);

        const sqlFile = generateSQLSchema(this.resources, this.options.schema);
        files.push(sqlFile);
      }

      // 生成索引文件
      const indexFile = generateTypesIndex();
      files.push(indexFile);
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'GENERATION_ERROR',
      });
    }

    return { files, errors, warnings };
  }

  /**
   * 生成代码并写入磁盘
   *
   * @param options 额外选项
   * @param options.dryRun 是否为试运行模式（不实际写入文件）
   * @param options.clean 是否在生成前清空输出目录
   * @returns 生成结果
   *
   * **示例**：
   * ```typescript
   * // 试运行（不写入文件）
   * const preview = await codegen.generateAndWrite({ dryRun: true });
   *
   * // 清空后生成
   * const result = await codegen.generateAndWrite({ clean: true });
   * ```
   */
  async generateAndWrite(
    options: { dryRun?: boolean; clean?: boolean } = {}
  ): Promise<GenerationResult> {
    const result = this.generate();

    if (result.errors.length > 0) {
      return result;
    }

    const writer = new FileWriter(this.options.outputDir, { dryRun: options.dryRun });

    if (options.clean) {
      writer.clean();
    }

    writer.writeResult(result);

    return result;
  }

  /**
   * 添加单个资源定义
   *
   * @param resource 资源定义
   * @returns this，支持链式调用
   *
   * **示例**：
   * ```typescript
   * codegen.addResource(userResource).addResource(postResource);
   * ```
   */
  addResource(resource: ResourceDefinition): this {
    this.resources.push(resource);
    return this;
  }

  /**
   * 批量添加资源定义
   *
   * @param resources 资源定义数组
   * @returns this，支持链式调用
   *
   * **示例**：
   * ```typescript
   * codegen.addResources([userResource, postResource, commentResource]);
   * ```
   */
  addResources(resources: ResourceDefinition[]): this {
    this.resources.push(...resources);
    return this;
  }
}

/**
 * 创建代码生成器实例
 * 便捷工厂函数
 *
 * @param options 代码生成选项
 * @returns 代码生成器实例
 *
 * @example
 * ```typescript
 * const codegen = createCodegen({
 *   outputDir: './generated',
 *   resources: [userResource],
 * });
 * ```
 */
export function createCodegen(options: CodegenOptions): Codegen {
  return new Codegen(options);
}

/**
 * 快速生成函数
 * 一站式代码生成入口
 *
 * @param resources 资源定义列表
 * @param outputDir 输出目录
 * @param options 额外的代码生成选项
 * @returns 生成结果
 *
 * @example
 * ```typescript
 * const result = await generate(
 *   [userResource, postResource],
 *   './src/generated',
 *   {
 *     typescript: { includeZodSchemas: true },
 *     schema: { enabled: true, dialect: 'postgresql' },
 *   }
 * );
 * ```
 */
export async function generate(
  resources: ResourceDefinition[],
  outputDir: string,
  options: Partial<CodegenOptions> = {}
): Promise<GenerationResult> {
  const codegen = createCodegen({
    resources,
    outputDir,
    ...options,
  });

  return codegen.generateAndWrite();
}
