#!/usr/bin/env node
import './pdfjsNodeSetup.js';
import { program } from 'commander';
import { compareCommand } from './commands/compare.js';

program
  .name('pdf-diff')
  .description('Compare two PDF documents — text + visual diff for CI/CD')
  .version('0.1.0');

program
  .command('compare <original> <modified>')
  .description('Compare two PDF files')
  .option('--output <format>', 'Output format: json | html | text', 'text')
  .option('--out <file>', 'Write output to file instead of stdout')
  .option(
    '--mode <mode>',
    'Comparison mode: text+visual | text-only | visual-only',
    'text+visual'
  )
  .option('--auto-map', 'Auto-detect page mapping using similarity', false)
  .option('--map <spec>', 'Manual page mapping, e.g. "1:1,2:2,3:null,null:4"')
  .option('--max-visual-diff <pct>', 'Max allowed visual diff ratio (0-1)', parseFloat)
  .option('--max-text-changes <n>', 'Max allowed text char changes', parseInt)
  .option('--ignore-case', 'Ignore case in text comparison', false)
  .option('--ignore-whitespace', 'Ignore whitespace in text comparison', false)
  .action(async (original: string, modified: string, opts) => {
    await compareCommand(original, modified, {
      output: opts.output as 'json' | 'html' | 'text',
      out: opts.out,
      mode: opts.mode as 'text+visual' | 'text-only' | 'visual-only',
      autoMap: opts.autoMap as boolean,
      map: opts.map as string | undefined,
      maxVisualDiff: opts.maxVisualDiff as number | undefined,
      maxTextChanges: opts.maxTextChanges as number | undefined,
      ignoreCase: opts.ignoreCase as boolean,
      ignoreWhitespace: opts.ignoreWhitespace as boolean,
    });
  });

program.parse();
