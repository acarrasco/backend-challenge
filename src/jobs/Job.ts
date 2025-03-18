import { Result } from '../models/Result';
import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';

export interface JobInput {
    task: Task;
    result?: Result;
}

export interface Job {
    run(task: Task, ...inputs: JobInput[]): Promise<any>;
    nextStatus(task: Task, workflow: Workflow): TaskStatus | undefined;
    getDependencies(task: Task, workflow: Workflow): Task[];
}

export abstract class DefaultJob implements Job {
    abstract run(task: Task, ...inputs: JobInput[]): Promise<any>;

    /**
     * Determines the next status for a task, based on its dependencies.
     *
     * IMPORTANT: this is a simple implementation that does not take into
     * account nested dependencies. That means that if we have the following
     * dependency graph: A(aborted) -> B(queued) -> C(queued)
     * then nextStatus(B) = aborted
     * but nextStatus(C) = undefined (not changed)
     *
     * To work around this we can traverse the dependency graph recursively
     * here, or re-run the calculations until the statuses are stable.
     *
     * @param task The task to calculate the next status
     * @param workflow The workflow for the task (make it explicit that we need it).
     * @returns the next status for the task or undefined if it did not change
     */
    nextStatus(task: Task, workflow: Workflow): TaskStatus | undefined {
        if (task.isFinished() || task.status === TaskStatus.Ready) {
            // no status change
            return undefined;
        }

        const dependencies = this.getDependencies(task, workflow);

        // XXX there is a more elegant way to do this if TaskStatus values were
        // objects with a virtual method we could use in a `reduce` operation...

        if (dependencies.some(d => d.isError())) {
            return TaskStatus.Aborted;
        }
        if (dependencies.every(d => d.status === TaskStatus.Completed)) {
            return TaskStatus.Ready;
        }
        return undefined;
    }

    /**
     * Default implementation, for tasks with dependencies explicitly defined.
     *
     * @param task The task to get dependencies for.
     * @param workflow The workflow for the task (make it explicit that we need it).
     * @returns an empty list of tasks
     */
    getDependencies(task: Task, workflow: Workflow): Task[] {
        const dependencies = new Set(task.dependsOn);
        return workflow.tasks.filter(t => dependencies.has(t.stepNumber));
    }
}
