export interface ChildSubtask {
  description: string;
  details?: string;
}

export interface ChildCli {
  createChild(parentId: string, title: string, description: string): Promise<{ id: string }>;
}

export interface ChildMapper {
  addSubtask(taskTmId: number, subtaskTmId: number, beadsId: string): void;
}

export interface ChildTask {
  id: number;
  subtasks?: Array<ChildSubtask & { id: number; title: string }>;
}

export interface ChildEpicMapper extends ChildMapper {
  getEpicId(tmId: number): string | undefined;
}

export function formatChildDescription(subtask: ChildSubtask): string {
  const parts: string[] = [subtask.description];

  if (
    subtask.details !== null &&
    subtask.details !== undefined &&
    subtask.details.trim().length > 0
  ) {
    parts.push("");
    parts.push("## Implementation Details");
    parts.push(subtask.details);
  }

  return parts.join("\n");
}

export async function createChildren(
  task: ChildTask,
  epicId: string,
  cli: ChildCli,
  mapper: ChildMapper
): Promise<void> {
  if (!task.subtasks || task.subtasks.length === 0) return;

  // Sort by id for deterministic ordering
  const sorted = [...task.subtasks].sort((a, b) => a.id - b.id);

  for (const subtask of sorted) {
    const description = formatChildDescription(subtask);
    const result = await cli.createChild(epicId, subtask.title, description);
    mapper.addSubtask(task.id, subtask.id, result.id);
  }
}

export async function createAllChildren(
  tasks: ChildTask[],
  cli: ChildCli,
  mapper: ChildEpicMapper,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const totalSubtasks = tasks.reduce((sum, t) => sum + (t.subtasks?.length || 0), 0);
  let processed = 0;

  for (const task of tasks) {
    const epicId = mapper.getEpicId(task.id);
    if (!epicId) {
      throw new Error(`Epic ID not found for task ${task.id} - epic must be created first`);
    }
    await createChildren(task, epicId, cli, mapper);
    processed += task.subtasks?.length || 0;
    if (onProgress) {
      onProgress(processed, totalSubtasks);
    }
  }
}
