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

    // 3. Run sync pipeline
    try {
      console.log(chalk.bold('tm2bd: Task-Master to Beads Sync\n'));

      // Parse tasks
      const { parseTasksJson } = await import('./schemas/taskmaster.js');
      console.log(chalk.blue('Loading tasks...'));
      const project = await parseTasksJson(options.tasks);
      console.log(chalk.green(`  Loaded ${project.tasks.length} tasks from ${options.tasks}`));

      // Topological sort
      const { topoSortDeterministic } = await import('./utils/topo-sort.js');
      const sorted = topoSortDeterministic(project.tasks);
      const maxTier = sorted.length > 0 ? sorted[sorted.length - 1].tier : 0;
      console.log(chalk.green(`  Sorted into ${maxTier + 1} tiers`));

      // Dry-run mode
      if (options.dryRun) {
        console.log(chalk.yellow('\n[DRY RUN MODE - No changes will be made]\n'));
        for (const task of sorted) {
          console.log(chalk.gray(`  bd create --title="${task.title}" -t epic -p ${task.priority}`));
          if (task.subtasks) {
            for (const sub of task.subtasks) {
              console.log(chalk.gray(`    bd create --title="${sub.title}" --parent <epic-id>`));
            }
          }
          for (const depId of task.dependencies) {
            console.log(chalk.gray(`  bd dep add <task-${task.id}-epic> <task-${depId}-epic>`));
          }
        }
        console.log(chalk.yellow('\nDry run complete. No changes were made.'));
        process.exit(0);
      }

      // Create Beads CLI wrapper
      const { BeadsCli } = await import('./beads/cli.js');
      const cli = new BeadsCli({ projectPath: options.project, verbose: options.verbose });

      // Create epics
      const { createEpics } = await import('./sync/epic-creator.js');
      console.log(chalk.blue('\nCreating epics...'));
      await createEpics(sorted, cli, mapper, (current, total) => {
        console.log(chalk.gray(`  ${current}/${total} epics created`));
      });
      console.log(chalk.green(`  All ${sorted.length} epics created`));

      // Create children
      const { createAllChildren } = await import('./sync/child-creator.js');
      console.log(chalk.blue('\nCreating child issues...'));
      await createAllChildren(sorted, cli, mapper, (current, total) => {
        console.log(chalk.gray(`  ${current}/${total} children created`));
      });
      console.log(chalk.green('  All children created'));

      // Wire dependencies
      const { wireAllDependencies } = await import('./sync/dependency-wirer.js');
      console.log(chalk.blue('\nWiring dependencies...'));
      await wireAllDependencies(sorted, cli, mapper);
      console.log(chalk.green('  All dependencies wired'));

      // Sync statuses
      const { syncAllStatuses } = await import('./sync/status-syncer.js');
      console.log(chalk.blue('\nSyncing statuses...'));
      await syncAllStatuses(sorted, cli, mapper);
      console.log(chalk.green('  All statuses synchronized'));

      // Save mapping
      await mapper.save(options.mapFile);
      console.log(chalk.green(`\n  Mapping saved to ${options.mapFile}`));

      console.log(chalk.bold.green('\nSync complete!'));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\nSync failed: ${message}`));
      process.exit(1);
    }
  });

program.parse();
