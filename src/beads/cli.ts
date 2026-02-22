import { execa } from 'execa';
import { z } from 'zod';

const BeadsCreateOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string().optional(),
});

type BeadsCreateResult = z.infer<typeof BeadsCreateOutputSchema>;

interface BeadsCliOptions {
  projectPath: string;
  verbose?: boolean;
}

class BeadsCli {
  private projectPath: string;
  private verbose: boolean;

  constructor({ projectPath, verbose = false }: BeadsCliOptions) {
    this.projectPath = projectPath;
    this.verbose = verbose;
  }

  private async exec(args: string[]): Promise<string> {
    if (this.verbose) {
      console.log(`[bd] ${args.join(' ')}`);
    }
    try {
      const result = await execa('bd', args, { cwd: this.projectPath });
      if (this.verbose && result.stdout) {
        console.log(result.stdout);
      }
      return result.stdout;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new Error('bd command not found - ensure beads is installed');
      }
      if (error && typeof error === 'object' && 'stderr' in error) {
        const stderr = (error as { stderr: string }).stderr;
        throw new Error(`bd command failed: ${args.join(' ')}\n${stderr}`);
      }
      throw error;
    }
  }

  async checkInit(): Promise<boolean> {
    try {
      const { access } = await import('node:fs/promises');
      await access(`${this.projectPath}/.beads`);
      return true;
    } catch {
      return false;
    }
  }

  async addDependency(blockedId: string, blockingId: string): Promise<void> {
    await this.exec(['dep', 'add', blockedId, blockingId]);
  }

  async updateStatus(issueId: string, status: string): Promise<void> {
    await this.exec(['update', issueId, '--status=' + status]);
  }

  async close(issueId: string): Promise<void> {
    await this.exec(['close', issueId]);
  }

  async createEpic(title: string, description: string, priority: number): Promise<BeadsCreateResult> {
    const args = ['create', `--title=${title}`, '-t', 'epic', '-p', priority.toString(), '--json'];
    if (description) {
      args.push(`--description=${description}`);
    }
    const stdout = await this.exec(args);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(`Failed to parse bd output as JSON: ${stdout}`);
      }
      throw e;
    }
    return BeadsCreateOutputSchema.parse(parsed);
  }

  async createChild(parentId: string, title: string, description: string): Promise<BeadsCreateResult> {
    const args = ['create', `--title=${title}`, '--parent', parentId, '--json'];
    if (description) {
      args.push(`--description=${description}`);
    }
    const stdout = await this.exec(args);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(`Failed to parse bd output as JSON: ${stdout}`);
      }
      throw e;
    }
    return BeadsCreateOutputSchema.parse(parsed);
  }
}

export { BeadsCli };
export type { BeadsCreateResult };
export default BeadsCli;
