import { In, Repository } from 'typeorm';
import { Task } from '../models/Task';
import { getJobForTaskType } from '../jobs/JobFactory';
import { WorkflowStatus } from '../workflows/WorkflowFactory';
import { Workflow } from '../models/Workflow';
import { Result } from '../models/Result';

export enum TaskStatus {
    /**
     * The task is waiting for its dependencies to complete
     */
    Queued = 'queued',
    /**
     * The task is ready to run, its dependencies have completed
     */
    Ready = 'ready',
    /**
     * The task is running
     */
    InProgress = 'in_progress',
    /**
     * The task finished successfully
     */
    Completed = 'completed',
    /**
     * The task exited with an error
     */
    Failed = 'failed',
    /**
     * Some of the dependencies failed
     */
    Aborted = 'aborted',
}

/**
 * Returns a list of tasks that have their statuses updated.
 *
 * It takes care of nested dependencies by invoking itself
 * recursively until there are no further changes.
 *
 * @param remaining Tasks whose status have not changed (yet)
 * @returns The tasks that have their status updated.
 */
function getChangedTasks(remaining: Task[]): Task[] {
    const changed: Task[] = [];
    const unchanged: Task[] = [];

    for (const task of remaining) {
        const nextStatus = getJobForTaskType(task.taskType).nextStatus(task);
        if (nextStatus) {
            console.log(`Task ${task.taskId} of type ${task.taskType} is ${nextStatus}`);
            task.status = nextStatus;
            changed.push(task);
        } else {
            unchanged.push(task);
        }
    }

    if (changed.length) {
        changed.push(...getChangedTasks(unchanged));
    }

    return changed;
}

/**
 * For every queued task in the workflow, checks if the status has changed and updates it.
 *
 * @param workflow The workflow its tasks statuses should be updated.
 * @returns The tasks that have an updated status.
 */
export function updateQueuedTasksStatus(workflow: Workflow): Task[] {
    workflow.linkTasks();
    const queuedTasks = workflow.tasks.filter(t => t.status === TaskStatus.Queued);
    return getChangedTasks(queuedTasks);
}

export class TaskRunner {
    constructor(private taskRepository: Repository<Task>) {}

    /**
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
     */
    async run(task: Task): Promise<void> {
        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        await this.taskRepository.save(task);
        const job = getJobForTaskType(task.taskType);

        try {
            console.log(`Starting job ${task.taskType} for task ${task.taskId}...`);
            const resultRepository = this.taskRepository.manager.getRepository(Result);
            const dependencies = job.getDependencies(task);
            const inputs = await resultRepository.findBy({ resultId: In(dependencies.map(t => t.resultId)) });
            const taskResult = await job.run(task, ...inputs);
            console.log(`Job ${task.taskType} for task ${task.taskId} completed successfully.`);
            const result = new Result();
            result.taskId = task.taskId!;
            result.data = JSON.stringify(taskResult || {});
            await resultRepository.save(result);
            task.resultId = result.resultId!;
            task.status = TaskStatus.Completed;
            task.progress = null;
            await this.taskRepository.save(task);
        } catch (error: any) {
            console.error(`Error running job ${task.taskType} for task ${task.taskId}:`, error);

            task.status = TaskStatus.Failed;
            task.progress = null;
            await this.taskRepository.save(task);
        }

        const workflowRepository = this.taskRepository.manager.getRepository(Workflow);
        const currentWorkflow = await workflowRepository.findOne({
            where: { workflowId: task.workflow.workflowId },
            relations: ['tasks'],
        });

        if (currentWorkflow) {
            const allCompleted = currentWorkflow.tasks.every(t => t.status === TaskStatus.Completed);
            const anyFailed = currentWorkflow.tasks.some(t => t.status === TaskStatus.Failed);

            if (anyFailed) {
                currentWorkflow.status = WorkflowStatus.Failed;
            } else if (allCompleted) {
                currentWorkflow.status = WorkflowStatus.Completed;
            } else {
                currentWorkflow.status = WorkflowStatus.InProgress;
            }

            const changedStatusTasks = updateQueuedTasksStatus(currentWorkflow);

            await this.taskRepository.save(changedStatusTasks);
            await workflowRepository.save(currentWorkflow);
        }
    }
}
