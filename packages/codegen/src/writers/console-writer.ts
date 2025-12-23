import type { GeneratedFile, GenerationResult } from '../types.js';

/**
 * Console writer for preview
 */
export class ConsoleWriter {
  private showContent: boolean;
  private maxContentLines: number;

  constructor(options: { showContent?: boolean; maxContentLines?: number } = {}) {
    this.showContent = options.showContent ?? true;
    this.maxContentLines = options.maxContentLines ?? 50;
  }

  /**
   * Preview single file
   */
  previewFile(file: GeneratedFile): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`File: ${file.path}`);
    console.log(`Type: ${file.type}`);
    console.log('='.repeat(60));

    if (this.showContent) {
      const lines = file.content.split('\n');

      if (lines.length > this.maxContentLines) {
        console.log(lines.slice(0, this.maxContentLines).join('\n'));
        console.log(`\n... (${lines.length - this.maxContentLines} more lines)`);
      } else {
        console.log(file.content);
      }
    }
  }

  /**
   * Preview multiple files
   */
  previewFiles(files: GeneratedFile[]): void {
    console.log(`\nGenerated ${files.length} files:\n`);

    for (const file of files) {
      console.log(`  - ${file.path} (${file.type})`);
    }

    if (this.showContent) {
      for (const file of files) {
        this.previewFile(file);
      }
    }
  }

  /**
   * Preview generation result
   */
  previewResult(result: GenerationResult): void {
    if (result.errors.length > 0) {
      console.error('\nErrors:');
      for (const error of result.errors) {
        console.error(`  ❌ ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      console.warn('\nWarnings:');
      for (const warning of result.warnings) {
        console.warn(`  ⚠️  ${warning}`);
      }
    }

    this.previewFiles(result.files);
  }
}

/**
 * Create console writer
 */
export function createConsoleWriter(options?: {
  showContent?: boolean;
  maxContentLines?: number;
}): ConsoleWriter {
  return new ConsoleWriter(options);
}
