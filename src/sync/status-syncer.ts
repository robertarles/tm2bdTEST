export interface StatusCli {
  close(id: string): Promise<void>;
  updateStatus(id: string, status: string): Promise<void>;
}

export interface StatusMapper {
  getEpicId(tmId: number): string | undefined;
  getSubtaskId(taskTmId: number, subtaskTmId: number): string | undefined;
}

export interface StatusTask {
  id: number;
  status: string;
  subtasks?: Array<{ id: number; status: string }>;
}

export function mapStatus(tmStatus: string): { status?: string; close: boolean } {
  switch (tmStatus) {
    case 'pending':
      return { close: false };
    case 'in-progress':
      return { status: 'in_progress', close: false };
    case 'done':
      return { close: true };
    case 'deferred':
      return { status: 'deferred', close: false };
    default:
      throw new Error(`Unknown task status: ${tmStatus}`);
  }
}

export async function syncEpicStatus(
  task: StatusTask,
  cli: StatusCli,
  mapper: StatusMapper,
): Promise<void> {
  const epicId = mapper.getEpicId(task.id);
  if (epicId === undefined) {
    throw new Error(`No epic ID found for task ${task.id}`);
  }

  const mapped = mapStatus(task.status);

  if (mapped.close) {
    await cli.close(epicId);
  } else if (mapped.status !== undefined) {
    await cli.updateStatus(epicId, mapped.status);
  }
}

export async function syncSubtaskStatus(
  task: StatusTask,
  cli: StatusCli,
  mapper: StatusMapper,
): Promise<void> {
  if (task.subtasks === undefined || task.subtasks.length === 0) {
    return;
  }

  for (const subtask of task.subtasks) {
    const subtaskId = mapper.getSubtaskId(task.id, subtask.id);
    if (subtaskId === undefined) {
      throw new Error(
        `No subtask ID found for task ${task.id}, subtask ${subtask.id}`,
      );
    }

    const mapped = mapStatus(subtask.status);

    if (mapped.close) {
      await cli.close(subtaskId);
    } else if (mapped.status !== undefined) {
      await cli.updateStatus(subtaskId, mapped.status);
    }
  }
}

export async function syncAllStatuses(
  tasks: StatusTask[],
  cli: StatusCli,
  mapper: StatusMapper,
): Promise<void> {
  for (const task of tasks) {
    await syncEpicStatus(task, cli, mapper);
    await syncSubtaskStatus(task, cli, mapper);
  }
}
