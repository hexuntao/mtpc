#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import { createCodegen } from './codegen.js';

/**
 * CLI entry point
 */
async function main() {
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

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const command = positionals[0] ?? 'generate';

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
 * Run generate command
 */
async function runGenerate(options: Record<string, unknown>) {
  const configPath = path.resolve(process.cwd(), options.config as string);

  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    console.log('Run "mtpc-codegen init" to create a config file.');
    process.exit(1);
  }

  try {
    const config = await import(configPath);
    const resources = config.default?.resources ?? config.resources ?? [];

    if (resources.length === 0) {
      console.warn('No resources found in config.');
      return;
    }

    const codegen = createCodegen({
      resources,
      outputDir: options.output as string,
    });

    const result = await codegen.generateAndWrite({
      dryRun: options.dryRun as boolean,
      clean: options.clean as boolean,
    });

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
 * Run init command
 */
async function runInit(options: Record<string, unknown>) {
  const configPath = path.resolve(process.cwd(), options.config as string);

  if (fs.existsSync(configPath)) {
    console.log(`Config file already exists: ${configPath}`);
    return;
  }

  const configContent = `import { z } from 'zod';
import { defineResource } from '@mtpc/core';

// Example resource definition
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

  fs.writeFileSync(configPath, configContent, 'utf-8');
  console.log(`Created config file: ${configPath}`);
  console.log('\nEdit the config file to define your resources, then run:');
  console.log('  mtpc-codegen generate');
}

/**
 * Print help
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

main().catch(console.error);
