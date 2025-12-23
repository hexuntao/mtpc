import fs from 'fs';
import path from 'path';
import type { GeneratedFile, GenerationResult } from '../types.js';

/**
 * 文件写入器
 * 负责将生成的代码写入磁盘
 *
 * **功能**：
 * - 创建目录结构
 * - 写入文件内容
 * - 支持试运行模式（不实际写入）
 * - 支持清空输出目录
 *
 * **示例**：
 * ```typescript
 * const writer = new FileWriter('./generated', { dryRun: false });
 * writer.writeResult(generationResult);
 * ```
 */
export class FileWriter {
  /** 输出目录路径 */
  private outputDir: string;
  /** 是否为试运行模式 */
  private dryRun: boolean;

  /**
   * 创建文件写入器
   * @param outputDir 输出目录路径
   * @param options 写入选项
   * @param options.dryRun 是否为试运行模式（不实际写入文件）
   */
  constructor(outputDir: string, options: { dryRun?: boolean } = {}) {
    this.outputDir = outputDir;
    this.dryRun = options.dryRun ?? false;
  }

  /**
   * 写入单个文件
   *
   * @param file 要写入的文件
   *
   * **处理流程**：
   * 1. 构建完整文件路径
   * 2. 创建父目录（如果不存在）
   * 3. 在试运行模式下只打印日志
   * 4. 否则写入文件内容
   */
  writeFile(file: GeneratedFile): void {
    const filePath = path.join(this.outputDir, file.path);
    const dir = path.dirname(filePath);

    // 试运行模式
    if (this.dryRun) {
      console.log(`[DRY RUN] Would write: ${filePath}`);
      return;
    }

    // 创建父目录
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(filePath, file.content, 'utf-8');
    console.log(`Generated: ${filePath}`);
  }

  /**
   * 写入多个文件
   *
   * @param files 要写入的文件列表
   *
   * **示例**：
   * ```typescript
   * writer.writeFiles([
   *   { path: 'permissions.ts', content: '...', type: 'typescript' },
   *   { path: 'types.ts', content: '...', type: 'typescript' },
   * ]);
   * ```
   */
  writeFiles(files: GeneratedFile[]): void {
    for (const file of files) {
      this.writeFile(file);
    }
  }

  /**
   * 写入生成结果
   *
   * @param result 生成结果
   *
   * **处理流程**：
   * 1. 显示错误列表（如果有）
   * 2. 显示警告列表（如果有）
   * 3. 写入所有文件
   * 4. 显示生成摘要
   */
  writeResult(result: GenerationResult): void {
    // 显示错误
    if (result.errors.length > 0) {
      console.error('Errors during generation:');
      for (const error of result.errors) {
        console.error(`  - ${error.message}`);
      }
    }

    // 显示警告
    if (result.warnings.length > 0) {
      console.warn('Warnings:');
      for (const warning of result.warnings) {
        console.warn(`  - ${warning}`);
      }
    }

    // 写入文件
    this.writeFiles(result.files);

    // 显示摘要
    console.log(`\nGenerated ${result.files.length} files`);
  }

  /**
   * 清空输出目录
   *
   * **操作流程**：
   * 1. 在试运行模式下只打印日志
   * 2. 删除整个输出目录
   * 3. 重新创建空目录
   *
   * **注意**：此操作不可逆，会删除目录中的所有文件
   */
  clean(): void {
    // 试运行模式
    if (this.dryRun) {
      console.log(`[DRY RUN] Would clean: ${this.outputDir}`);
      return;
    }

    // 删除目录
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true });
      console.log(`Cleaned: ${this.outputDir}`);
    }

    // 重新创建空目录
    fs.mkdirSync(this.outputDir, { recursive: true });
  }
}

/**
 * 创建文件写入器
 * 便捷工厂函数
 *
 * @param outputDir 输出目录路径
 * @param options 写入选项
 * @returns 文件写入器实例
 *
 * @example
 * ```typescript
 * const writer = createFileWriter('./generated', { dryRun: true });
 * writer.writeResult(result);
 * ```
 */
export function createFileWriter(outputDir: string, options?: { dryRun?: boolean }): FileWriter {
  return new FileWriter(outputDir, options);
}
