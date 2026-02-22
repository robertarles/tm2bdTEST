#!/usr/bin/env node
import { Command } from 'commander';

interface SyncOptions {
  tasks: string;
  project: string;
  dryRun: boolean;
  force: boolean;
  resume: boolean;
  mapFile: string;
  verbose: boolean;
}

const program = new Command();

program
  .name('tm2bd')
  .description('Sync task-master-ai tasks to Beads issue tracker')
  .version('0.1.0');

program
  .command('sync')
  .description('Synchronize tasks from task-master-ai to Beads')
  .option('-t, --tasks <path>', 'Path to tasks.json file', '.tasks/tasks.json')
  .option('-p, --project <path>', 'Path to Beads project directory', '.')
  .option('-d, --dry-run', 'Preview changes without executing', false)
  .option('-f, --force', 'Force sync even if mapping file exists', false)
  .option('-r, --resume', 'Resume from existing mapping file', false)
  .option('-m, --map-file <path>', 'Path to ID mapping file', './tm2bd-map.json')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options: SyncOptions) => {
    const { default: chalk } = await import('chalk');

    if (options.verbose) {
      console.log('Options:', options);
    }

    // 1. Check Beads initialization
    const beadsDir = `${options.project}/.beads`;
    try {
      const { access } = await import('node:fs/promises');
      await access(beadsDir);
    } catch {
      console.error(chalk.red('Error: Beads is not initialized in this project.'));
      console.error(chalk.red(`Expected .beads/ directory at: ${beadsDir}`));
      process.exit(1);
    }

    // 2. Check mapping file idempotency
    const { IdMapper } = await import('./mapping/id-mapper.js');
    const mapExists = await IdMapper.exists(options.mapFile);

    let mapper: InstanceType<typeof IdMapper>;

    if (mapExists && !options.force && !options.resume) {
      console.error(chalk.red(`Error: Mapping file already exists at ${options.mapFile}`));
      console.error(chalk.yellow('Use --force to overwrite or --resume to continue from existing mapping.'));
      process.exit(1);
    } else if (options.resume && mapExists) {
      mapper = await IdMapper.load(options.mapFile);
      console.log(chalk.green('Resumed from existing mapping file.'));
    } else {
      mapper = new IdMapper();
    }

    // Sync pipeline will be wired here in 9sz.3+
    console.log('Precondition checks passed. Sync pipeline not yet wired.');
  });

program.parse();
