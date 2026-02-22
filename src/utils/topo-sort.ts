export interface SortableTask {
  id: number;
  dependencies: number[];
}

export interface TieredTask extends SortableTask {
  tier: number;
}

export function topoSort(tasks: SortableTask[]): SortableTask[] {
  const taskMap = new Map<number, SortableTask>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const visiting = new Set<number>();
  const visited = new Set<number>();
  const result: SortableTask[] = [];

  function visit(id: number): void {
    if (visiting.has(id)) {
      throw new Error(`Cycle detected: task ${id} is part of a dependency cycle`);
    }

    if (visited.has(id)) {
      return;
    }

    const task = taskMap.get(id);
    if (!task) {
      throw new Error(`Missing task: dependency references task ${id}, which does not exist`);
    }

    visiting.add(id);

    for (const depId of task.dependencies) {
      if (depId === id) {
        throw new Error(`Cycle detected: task ${id} depends on itself`);
      }
      visit(depId);
    }

    visiting.delete(id);
    visited.add(id);
    result.push(task);
  }

  for (const task of tasks) {
    visit(task.id);
  }

  return result;
}

export function topoSortWithTiers(tasks: SortableTask[]): TieredTask[] {
  const taskMap = new Map<number, SortableTask>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const visiting = new Set<number>();
  const visited = new Set<number>();
  const tierMap = new Map<number, number>();
  const result: TieredTask[] = [];

  function visit(id: number): number {
    if (visiting.has(id)) {
      throw new Error(`Cycle detected: task ${id} is part of a dependency cycle`);
    }

    if (visited.has(id)) {
      return tierMap.get(id)!;
    }

    const task = taskMap.get(id);
    if (!task) {
      throw new Error(`Missing task: dependency references task ${id}, which does not exist`);
    }

    visiting.add(id);

    let maxDepTier = -1;
    for (const depId of task.dependencies) {
      if (depId === id) {
        throw new Error(`Cycle detected: task ${id} depends on itself`);
      }
      const depTier = visit(depId);
      if (depTier > maxDepTier) {
        maxDepTier = depTier;
      }
    }

    const tier = maxDepTier + 1;

    visiting.delete(id);
    visited.add(id);
    tierMap.set(id, tier);
    result.push({ ...task, tier });

    return tier;
  }

  for (const task of tasks) {
    visit(task.id);
  }

  return result;
}
