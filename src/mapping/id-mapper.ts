import { readFile, writeFile, access } from 'node:fs/promises';

export interface MappingFile {
  version: string;
  generatedAt: string;
  tasks: TaskMapping[];
}

export interface SubtaskMapping {
  tmId: number;
  beadsId: string;
}

export interface TaskMapping {
  tmId: number;
  beadsId: string;
  subtasks: SubtaskMapping[];
}

export class IdMapper {
  private tasks: TaskMapping[] = [];

  addEpic(tmId: number, beadsId: string): void {
    this.tasks.push({ tmId, beadsId, subtasks: [] });
  }

  addSubtask(taskTmId: number, subtaskTmId: number, beadsId: string): void {
    const parent = this.tasks.find((t) => t.tmId === taskTmId);
    if (!parent) {
      throw new Error(
        `Parent task with tmId ${taskTmId} not found`,
      );
    }
    parent.subtasks.push({ tmId: subtaskTmId, beadsId });
  }

  getEpicId(tmId: number): string | undefined {
    return this.tasks.find((t) => t.tmId === tmId)?.beadsId;
  }

  getSubtaskId(taskTmId: number, subtaskTmId: number): string | undefined {
    const parent = this.tasks.find((t) => t.tmId === taskTmId);
    return parent?.subtasks.find((s) => s.tmId === subtaskTmId)?.beadsId;
  }

  async save(filePath: string): Promise<void> {
    const data: MappingFile = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      tasks: this.tasks,
    };
    await writeFile(filePath, JSON.stringify(data, null, 2));
  }

  static async load(filePath: string): Promise<IdMapper> {
    const raw = await readFile(filePath, 'utf-8');
    const data: MappingFile = JSON.parse(raw);
    const mapper = new IdMapper();
    mapper.tasks = data.tasks;
    return mapper;
  }

  static async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
