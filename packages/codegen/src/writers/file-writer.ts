import fs from 'fs';
import path from 'path';
import type { GeneratedFile, GenerationResult } from '../types.js';

/**
 * File writer for generated code
 */
export class FileWriter {
  private outputDir: string;
  private dryRun: boolean;

  constructor(outputDir: string, options: { dryRun?: boolean } = {}) {
    this.outputDir = outputDir;
    this.dryRun = options.dryRun ?? false;
  }

  /**
   * Write single file
   */
  writeFile(file: GeneratedFile): void {
    const filePath = path.join(this.outputDir, file.path);
    const dir = path.dirname(filePath);

    if (this.dryRun) {
      console.log(`[DRY RUN] Would write: ${filePath}`);
      return;
    }

    // Create directory if not exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, file.content, 'utf-8');
    console.log(`Generated: ${filePath}`);
  }

  /**
   * Write multiple files
   */
  writeFiles(files: GeneratedFile[]): void {
    for (const file of files) {
      this.writeFile(file);
    }
  }

  /**
   * Write generation result
   */
  writeResult(result: GenerationResult): void {
    if (result.errors.length > 0) {
      console.error('Errors during generation:');
      for (const error of result.errors) {
        console.error(`  - ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      console.warn('Warnings:');
      for (const warning of result.warnings) {
        console.warn(`  - ${warning}`);
      }
    }

    this.writeFiles(result.files);

    console.log(`\nGenerated ${result.files.length} files`);
  }

  /**
   * Clean output directory
   */
  clean(): void {
    if (this.dryRun) {
      console.log(`[DRY RUN] Would clean: ${this.outputDir}`);
      return;
    }

    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true });
      console.log(`Cleaned: ${this.outputDir}`);
    }

    fs.mkdirSync(this.outputDir, { recursive: true });
  }
}

/**
 * Create file writer
 */
export function createFileWriter(outputDir: string, options?: { dryRun?: boolean }): FileWriter {
  return new FileWriter(outputDir, options);
}
