#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import { createCodegen } from './codegen.js';

/**
 * CLI 入口函数
 * 处理命令行参数并执行相应的命令
 */
async function main() {
  // 解析命令行参数
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      config: {
        type: 'string',
        short: 'c',
        default: 'mtpc.config.js',
      },
      output: {
        type: 'string',
        short: 'o',
        default: './generated',
      },
      clean: {
        type: 'boolean',
        default: false,
      },
      dryRun: {
        type: 'boolean',
        default: false,
      },
      help: {
        type: 'boolean',
        short: 'h',
        default: false,
      },
    },
    allowPositionals: true,
  });

  // 显示帮助信息
  if (values.help) {
    printHelp();
    process.exit(0);
  }

  // 获取命令（默认为 generate）
  const command = positionals[0] ?? 'generate';

  // 执行对应的命令
  switch (command) {
    case 'generate':
      await runGenerate(values);
      break;
    case 'init':
      await runInit(values);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

/**
 * 执行 generate 命令
 * 从配置文件读取资源定义并生成代码
 *
 * @param options 命令行选项
 */
async function runGenerate(options: Record<string, unknown>) {
  const configPath = path.resolve(process.cwd(), options.config as string);

  // 检查配置文件是否存在
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    console.log('Run "mtpc-codegen init" to create a config file.');
    process.exit(1);
  }

  try {
    // 动态导入配置文件
    const config = await import(configPath);
    const resources = config.default?.resources ?? config.resources ?? [];

    // 检查是否有资源定义
    if (resources.length === 0) {
      console.warn('No resources found in config.');
      return;
    }

    // 创建代码生成器并执行生成
    const codegen = createCodegen({
      resources,
      outputDir: options.output as string,
    });

    const result = await codegen.generateAndWrite({
      dryRun: options.dryRun as boolean,
      clean: options.clean as boolean,
    });

    // 检查是否有错误
    if (result.errors.length > 0) {
      console.error('\nGeneration failed with errors.');
      process.exit(1);
    }

    console.log('\n✅ Code generation completed successfully!');
  } catch (error) {
    console.error('Failed to load config:', error);
    process.exit(1);
  }
}

/**
 * 执行 init 命令
 * 创建示例配置文件
 *
 * @param options 命令行选项
 */
async function runInit(options: Record<string, unknown>) {
  const configPath = path.resolve(process.cwd(), options.config as string);

  // 检查配置文件是否已存在
  if (fs.existsSync(configPath)) {
    console.log(`Config file already exists: ${configPath}`);
    return;
  }

  // 示例配置文件内容
  const configContent = `import { z } from 'zod';
import { defineResource } from '@mtpc/core';

// 示例资源定义
const exampleResource = defineResource({
  name: 'example',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    status: z.enum(['active', 'inactive']).default('active'),
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
    list: true,
  },
  metadata: {
    displayName: 'Example',
    description: 'An example resource',
  },
});

export const resources = [exampleResource];
export default { resources };
`;

  // 写入配置文件
  fs.writeFileSync(configPath, configContent, 'utf-8');
  console.log(`Created config file: ${configPath}`);
  console.log('\nEdit the config file to define your resources, then run:');
  console.log('  mtpc-codegen generate');
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(`
MTPC Code Generator

Usage:
  mtpc-codegen [command] [options]

Commands:
  generate    Generate code from resource definitions (default)
  init        Create a config file

Options:
  -c, --config <path>   Config file path (default: mtpc.config.js)
  -o, --output <path>   Output directory (default: ./generated)
  --clean               Clean output directory before generating
  --dry-run             Preview without writing files
  -h, --help            Show this help message

Examples:
  mtpc-codegen generate
  mtpc-codegen generate -o ./src/generated
  mtpc-codegen generate --dry-run
  mtpc-codegen init
`);
}

// 执行 CLI
main().catch(console.error);
