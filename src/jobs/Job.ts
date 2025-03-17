import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';

export interface Job {
    run(task: Task): Promise<any>;
    nextStatus(task: Task): TaskStatus | undefined;
    getJobDependencies(task: Task): Task[];
}

export abstract class DefaultJob implements Job {
    abstract run(task: Task): Promise<any>;

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
     * here, or re-run the calculations until the status are stable.
     *
     * @param task The task to calculate the next status
     * @returns the next status for the task or undefined if it did not change
     */
    nextStatus(task: Task): TaskStatus | undefined {
        if (task.isFinished() || task.status === TaskStatus.Ready) {
            // no status change
            return undefined;
        }

        for (const dependency of this.getJobDependencies(task)) {
            if (dependency.status === TaskStatus.Aborted) {
                // if any of our dependencies was aborted, we are aborted
                return TaskStatus.Aborted;
            }
            if (dependency.status !== TaskStatus.Completed) {
                // if not all the dependencies are completed, we keep our status
                return undefined;
            }
        }
        // if all the dependencies were completed, we are ready
        return TaskStatus.Ready;
    }

    /**
     * Default implementation, for tasks without dependencies.
     * @param task The task to get dependencies for.
     * @returns an empty list of tasks
     */
    getJobDependencies(task: Task): Task[] {
        return [];
    }
}
