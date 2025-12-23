import type { Permission, ResourceDefinition } from '@mtpc/core';
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
 * Code generator class
 */
export class Codegen {
  private resources: ResourceDefinition[];
  private options: CodegenOptions;

  constructor(options: CodegenOptions) {
    this.resources = options.resources;
    this.options = options;
  }

  /**
   * Generate all code
   */
  generate(): GenerationResult {
    const files: GeneratedFile[] = [];
    const errors: Array<{ resource?: string; message: string; code: string }> = [];
    const warnings: string[] = [];

    try {
      // Generate permission codes
      if (this.options.permissions?.enabled !== false) {
        const permFile = generatePermissionCodes(this.resources, this.options.permissions);
        files.push(permFile);

        const permTypesFile = generatePermissionTypes(this.resources);
        files.push(permTypesFile);
      }

      // Generate TypeScript types
      if (this.options.typescript?.enabled !== false) {
        const typesFile = generateTypeScriptTypes(this.resources, this.options.typescript);
        files.push(typesFile);
      }

      // Generate metadata
      if (this.options.metadata?.enabled !== false) {
        const metadataFile = generateMetadataTS(this.resources, this.options.metadata);
        files.push(metadataFile);

        const metadataJsonFile = generateMetadata(this.resources, this.options.metadata);
        files.push(metadataJsonFile);
      }

      // Generate schema
      if (this.options.schema?.enabled) {
        const schemaFile = generateDrizzleSchema(this.resources, this.options.schema);
        files.push(schemaFile);

        const sqlFile = generateSQLSchema(this.resources, this.options.schema);
        files.push(sqlFile);
      }

      // Generate index file
      const indexFile = generateTypesIndex(this.resources);
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
   * Generate and write to disk
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
   * Add resource
   */
  addResource(resource: ResourceDefinition): this {
    this.resources.push(resource);
    return this;
  }

  /**
   * Add resources
   */
  addResources(resources: ResourceDefinition[]): this {
    this.resources.push(...resources);
    return this;
  }
}

/**
 * Create codegen instance
 */
export function createCodegen(options: CodegenOptions): Codegen {
  return new Codegen(options);
}

/**
 * Quick generate function
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
