export interface EpicTask {
  id: number;
  title: string;
  description: string;
  priority: string;
  details?: string;
  testStrategy?: string;
  complexity?: number;
  status: string;
}

export interface EpicCli {
  createEpic(title: string, description: string, priority: number): Promise<{ id: string }>;
}

export interface EpicMapper {
  addEpic(tmId: number, beadsId: string): void;
}

export function formatEpicDescription(task: EpicTask): string {
  const parts: string[] = [];

  parts.push(`## Description\n\n${task.description}`);

  if (task.details) {
    parts.push(`## Implementation Details\n\n${task.details}`);
  }

  if (task.testStrategy) {
    parts.push(`## Test Strategy\n\n${task.testStrategy}`);
  }

  const metadataLines: string[] = [
    `- **Task-master ID:** ${task.id}`,
  ];

  if (task.complexity !== undefined) {
    metadataLines.push(`- **Complexity:** ${task.complexity}`);
  }

  metadataLines.push(`- **Original status:** ${task.status}`);

  parts.push(`## Metadata\n\n${metadataLines.join('\n')}`);

  return parts.join('\n\n');
}

export function mapPriority(priority: string): number {
  switch (priority) {
    case 'high':
      return 0;
    case 'medium':
      return 1;
    case 'low':
      return 2;
    default:
      throw new Error(`Unknown priority: ${priority}`);
  }
}

export async function createEpic(task: EpicTask, cli: EpicCli, mapper: EpicMapper): Promise<string> {
  const description = formatEpicDescription(task);
  const priority = mapPriority(task.priority);
  const result = await cli.createEpic(task.title, description, priority);
  mapper.addEpic(task.id, result.id);
  return result.id;
}

export async function createEpics(
  tasks: EpicTask[],
  cli: EpicCli,
  mapper: EpicMapper,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < tasks.length; i++) {
    await createEpic(tasks[i], cli, mapper);
    if (onProgress) {
      onProgress(i + 1, tasks.length);
    }
  }
}
