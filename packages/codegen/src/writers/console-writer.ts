import type { GeneratedFile, GenerationResult } from '../types.js';

/**
 * 控制台输出器
 * 用于预览生成的代码内容
 *
 * **用途**：
 * - 在试运行模式下预览即将生成的文件
 * - 调试代码生成器
 * - 展示生成结果摘要
 *
 * **示例**：
 * ```typescript
 * const writer = new ConsoleWriter({ showContent: true, maxContentLines: 50 });
 * writer.previewResult(generationResult);
 * ```
 */
export class ConsoleWriter {
  /** 是否显示文件内容 */
  private showContent: boolean;
  /** 最大显示行数 */
  private maxContentLines: number;

  /**
   * 创建控制台输出器
   * @param options 输出选项
   * @param options.showContent 是否显示文件内容（默认 true）
   * @param options.maxContentLines 最大显示行数（默认 50）
   */
  constructor(options: { showContent?: boolean; maxContentLines?: number } = {}) {
    this.showContent = options.showContent ?? true;
    this.maxContentLines = options.maxContentLines ?? 50;
  }

  /**
   * 预览单个文件
   *
   * @param file 要预览的文件
   *
   * **输出格式**：
   * ```
   * ============================================================
   * File: permissions.ts
   * Type: typescript
   * ============================================================
   * // 文件内容...
   * ```
   */
  previewFile(file: GeneratedFile): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`File: ${file.path}`);
    console.log(`Type: ${file.type}`);
    console.log('='.repeat(60));

    if (this.showContent) {
      const lines = file.content.split('\n');

      // 超过最大行数时截断
      if (lines.length > this.maxContentLines) {
        console.log(lines.slice(0, this.maxContentLines).join('\n'));
        console.log(`\n... (${lines.length - this.maxContentLines} more lines)`);
      } else {
        console.log(file.content);
      }
    }
  }

  /**
   * 预览多个文件
   *
   * @param files 要预览的文件列表
   *
   * **输出格式**：
   * ```
   * Generated 5 files:
   *
   *   - permissions.ts (typescript)
   *   - types.ts (typescript)
   *   - metadata.json (json)
   *   - schema.ts (typescript)
   *   - schema.sql (sql)
   * ```
   */
  previewFiles(files: GeneratedFile[]): void {
    console.log(`\nGenerated ${files.length} files:\n`);

    for (const file of files) {
      console.log(`  - ${file.path} (${file.type})`);
    }

    // 显示详细内容
    if (this.showContent) {
      for (const file of files) {
        this.previewFile(file);
      }
    }
  }

  /**
   * 预览完整的生成结果
   *
   * @param result 生成结果
   *
   * **输出内容**：
   * - 错误列表（如果有）
   * - 警告列表（如果有）
   * - 文件列表和内容
   */
  previewResult(result: GenerationResult): void {
    // 显示错误
    if (result.errors.length > 0) {
      console.error('\nErrors:');
      for (const error of result.errors) {
        console.error(`  ❌ ${error.message}`);
      }
    }

    // 显示警告
    if (result.warnings.length > 0) {
      console.warn('\nWarnings:');
      for (const warning of result.warnings) {
        console.warn(`  ⚠️  ${warning}`);
      }
    }

    // 显示文件
    this.previewFiles(result.files);
  }
}

/**
 * 创建控制台输出器
 * 便捷工厂函数
 *
 * @param options 输出选项
 * @returns 控制台输出器实例
 *
 * @example
 * ```typescript
 * const writer = createConsoleWriter({ showContent: true });
 * writer.previewResult(result);
 * ```
 */
export function createConsoleWriter(options?: {
  showContent?: boolean;
  maxContentLines?: number;
}): ConsoleWriter {
  return new ConsoleWriter(options);
}
