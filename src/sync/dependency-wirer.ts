export interface DepCli {
  addDependency(blockedId: string, blockingId: string): Promise<void>;
}

export interface DepMapper {
  getEpicId(tmId: number): string | undefined;
  getSubtaskId(taskTmId: number, subtaskTmId: number): string | undefined;
}

export interface DepTask {
  id: number;
  dependencies: number[];
  subtasks?: { id: number; dependencies?: number[] }[];
}

export async function wireEpicDependencies(
  tasks: DepTask[],
  cli: DepCli,
  mapper: DepMapper,
): Promise<void> {
  for (const task of tasks) {
    if (task.dependencies.length === 0) {
      continue;
    }

    const blockedEpicId = mapper.getEpicId(task.id);
    if (!blockedEpicId) {
      throw new Error(
        `No epic ID found for task ${task.id}`,
      );
    }

    for (const depId of task.dependencies) {
      const blockingEpicId = mapper.getEpicId(depId);
      if (!blockingEpicId) {
        throw new Error(
          `No epic ID found for dependency ${depId} (required by task ${task.id})`,
        );
      }

      await cli.addDependency(blockedEpicId, blockingEpicId);
    }
  }
}

export async function wireSubtaskDependencies(
  tasks: DepTask[],
  cli: DepCli,
  mapper: DepMapper,
): Promise<void> {
  for (const task of tasks) {
    if (!task.subtasks) {
      continue;
    }

    for (const subtask of task.subtasks) {
      if (!subtask.dependencies || subtask.dependencies.length === 0) {
        continue;
      }

      const blockedChildId = mapper.getSubtaskId(task.id, subtask.id);
      if (!blockedChildId) {
        throw new Error(
          `No child ID found for subtask ${subtask.id} of task ${task.id}`,
        );
      }

      for (const depId of subtask.dependencies) {
        const blockingChildId = mapper.getSubtaskId(task.id, depId);
        if (!blockingChildId) {
          throw new Error(
            `No child ID found for subtask dependency ${depId} of task ${task.id} (required by subtask ${subtask.id})`,
          );
        }

        await cli.addDependency(blockedChildId, blockingChildId);
      }
    }
  }
}

export async function wireAllDependencies(
  tasks: DepTask[],
  cli: DepCli,
  mapper: DepMapper,
): Promise<void> {
  await wireEpicDependencies(tasks, cli, mapper);
  await wireSubtaskDependencies(tasks, cli, mapper);
}
