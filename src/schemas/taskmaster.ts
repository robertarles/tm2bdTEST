import { z } from "zod";
import { readFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const TaskMasterStatusSchema = z.enum([
  "pending",
  "in-progress",
  "done",
  "deferred",
]);

export const TaskMasterPrioritySchema = z.enum(["high", "medium", "low"]);

// ---------------------------------------------------------------------------
// Subtask
// ---------------------------------------------------------------------------

export const TaskMasterSubtaskSchema = z.object({
  id: z.coerce.number(),
  title: z.string(),
  description: z.string(),
  status: TaskMasterStatusSchema,
  dependencies: z.array(z.coerce.number()).optional(),
  details: z.string().optional(),
  testStrategy: z.string().optional(),
  parentId: z.unknown().optional(),
});

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export const TaskMasterTaskSchema = z.object({
  id: z.coerce.number(),
  title: z.string(),
  description: z.string(),
  status: TaskMasterStatusSchema,
  priority: TaskMasterPrioritySchema,
  dependencies: z.array(z.coerce.number()),
  complexity: z.coerce.number().min(1).max(10).optional(),
  subtasks: z.array(TaskMasterSubtaskSchema).optional(),
  details: z.string().optional(),
  testStrategy: z.string().optional(),
  recommendedSubtasks: z.number().optional(),
  expansionPrompt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Project (top-level wrapper)
// ---------------------------------------------------------------------------

const TaskMasterInnerSchema = z.object({
  tasks: z.array(TaskMasterTaskSchema),
});

export const TaskMasterProjectSchema = z.object({
  master: TaskMasterInnerSchema,
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type TaskMasterSubtask = z.infer<typeof TaskMasterSubtaskSchema>;
export type TaskMasterTask = z.infer<typeof TaskMasterTaskSchema>;
export type TaskMasterProject = z.infer<typeof TaskMasterInnerSchema>;

// ---------------------------------------------------------------------------
// parseTasksJson  -  read, parse, and validate a tasks.json file
// ---------------------------------------------------------------------------

export async function parseTasksJson(
  filePath: string,
): Promise<TaskMasterProject> {
  // 1. Read the file
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(
        `TaskMaster tasks file not found: ${filePath}`,
      );
    }
    throw new Error(
      `Failed to read TaskMaster tasks file (${filePath}): ${(err as Error).message}`,
    );
  }

  // 2. Parse the JSON
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err: unknown) {
    throw new Error(
      `Invalid JSON in TaskMaster tasks file (${filePath}): ${(err as Error).message}`,
    );
  }

  // 3. Validate against the schema using safeParse for better error messages
  const result = TaskMasterProjectSchema.safeParse(json);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return `  - ${path}: ${issue.message}`;
      })
      .join("\n");

    throw new Error(
      `TaskMaster tasks file failed schema validation (${filePath}):\n${issues}`,
    );
  }

  // Unwrap the master wrapper so callers get { tasks: [...] }
  return result.data.master;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Detect circular dependencies among tasks using depth-first search.
 *
 * Returns `true` when all dependency chains are acyclic (valid).
 * Returns `false` when at least one cycle is detected.
 */
export function validateCircularDependencies(
  tasks: TaskMasterTask[],
): boolean {
  const visited = new Set<number>();
  const visiting = new Set<number>();

  // Build an adjacency map for quick lookup: taskId -> dependency ids
  const depsMap = new Map<number, number[]>();
  for (const task of tasks) {
    depsMap.set(task.id, task.dependencies);
  }

  function dfs(taskId: number): boolean {
    if (visiting.has(taskId)) {
      // We have come back to a node that is currently being explored -> cycle
      return false;
    }
    if (visited.has(taskId)) {
      // Already fully explored with no cycle
      return true;
    }

    visiting.add(taskId);

    const deps = depsMap.get(taskId) ?? [];
    for (const depId of deps) {
      if (!dfs(depId)) {
        return false;
      }
    }

    visiting.delete(taskId);
    visited.add(taskId);
    return true;
  }

  for (const task of tasks) {
    if (!dfs(task.id)) {
      return false;
    }
  }

  return true;
}

/**
 * Verify that every dependency id referenced by any task actually corresponds
 * to an existing task in the list.
 *
 * Returns `true` when all dependency ids are valid.
 * Returns `false` when at least one dependency references a non-existent task.
 */
export function validateDependencyIds(tasks: TaskMasterTask[]): boolean {
  const taskIds = new Set(tasks.map((t) => t.id));

  for (const task of tasks) {
    for (const depId of task.dependencies) {
      if (!taskIds.has(depId)) {
        return false;
      }
    }
  }

  return true;
}
