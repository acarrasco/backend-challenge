import { Task } from '../models/Task';
import { WorkflowStatus } from '../workflows/WorkflowFactory';
import { Workflow } from '../models/Workflow';
import { Result } from '../models/Result';
import { Job, JobInput } from '../jobs/Job';
import { ReportGenerationJob } from '../jobs/ReportGenerationJob';

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
function getChangedTasks(remaining: Task[], workflow: Workflow, getJobForTask: (task: Task) => Job): Task[] {
    const changed: Task[] = [];
    const unchanged: Task[] = [];

    for (const task of remaining) {
        const nextStatus = getJobForTask(task).nextStatus(task, workflow);
        if (nextStatus) {
            console.log(
                `Workflow ${workflow.workflowId} Step ${task.stepNumber} of type ${task.taskType} is ${nextStatus}`,
            );
            task.status = nextStatus;
            changed.push(task);
        } else {
            unchanged.push(task);
        }
    }

    if (changed.length) {
        changed.push(...getChangedTasks(unchanged, workflow, getJobForTask));
    }

    return changed;
}

/**
 * For every queued task in the workflow, checks if the status has changed and updates it.
 *
 * @param workflow The workflow its tasks statuses should be updated.
 * @returns The tasks that have an updated status.
 */
export function updateQueuedTasksStatus(workflow: Workflow, getJobForTask: (task: Task) => Job): Task[] {
    const queuedTasks = workflow.tasks.filter(t => t.status === TaskStatus.Queued);
    return getChangedTasks(queuedTasks, workflow, getJobForTask);
}

async function getDataAndStatus(task: Task, job: Job, ...inputs: JobInput[]): Promise<[TaskStatus, string]> {
    try {
        const result = await job.run(task, ...inputs);
        return [TaskStatus.Completed, JSON.stringify(result || {})];
    } catch (error: any) {
        return [TaskStatus.Failed, error.toString()];
    }
}

export interface TaskRunnerDependencies {
    saveTasks(...task: Task[]): Promise<Task[]>;
    getResults(resultIds: string[]): Promise<Result[]>;
    saveResult(result: Result): Promise<Result>;
    getJobForTask(task: Task): Job;
    getWorkflow(workflowId: string): Promise<Workflow>;
    saveWorkflow(workflow: Workflow): Promise<Workflow>;
}

export class TaskRunner {
    constructor(private deps: TaskRunnerDependencies) {}

    /**
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
     */
    async run(task: Task, workflow: Workflow): Promise<void> {
        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        await this.deps.saveTasks(task);
        const job = this.deps.getJobForTask(task);

        console.log(`Starting job ${task.taskType} for task ${task.taskId}...`);
        const dependencies = job.getDependencies(task, workflow);
        const inputs = await this.getJobInputs(dependencies);

        const [status, data] = await getDataAndStatus(task, job, ...inputs);
        const result = new Result();
        result.taskId = task.taskId!;
        result.data = data;
        await this.deps.saveResult(result);
        task.resultId = result.resultId;
        task.status = status;
        task.progress = null;
        await this.deps.saveTasks(task);

        const updatedWorkflow = await this.deps.getWorkflow(workflow.workflowId);

        const allCompleted = updatedWorkflow.tasks.every(t => t.status === TaskStatus.Completed);
        const anyFailed = updatedWorkflow.tasks.some(t => t.status === TaskStatus.Failed);

        if (anyFailed) {
            updatedWorkflow.status = WorkflowStatus.Failed;
        } else if (allCompleted) {
            updatedWorkflow.status = WorkflowStatus.Completed;
            const allInputs = await this.getJobInputs(updatedWorkflow.tasks);
            updatedWorkflow.finalResult = ReportGenerationJob.makeFinalReport(allInputs);
        } else {
            updatedWorkflow.status = WorkflowStatus.InProgress;
        }

        const changedStatusTasks = updateQueuedTasksStatus(updatedWorkflow, this.deps.getJobForTask);

        await this.deps.saveTasks(...changedStatusTasks);
        await this.deps.saveWorkflow(updatedWorkflow);
    }

    async getJobInputs(tasks: Task[]): Promise<JobInput[]> {
        const inputResultIds = tasks.map(t => t.resultId).filter(x => x !== undefined);
        const results = await this.deps.getResults(inputResultIds);
        const resultsByTaskId = Object.fromEntries(results.map(r => [r.taskId, r]));
        const jobInputs = tasks.map(t => ({ task: t, result: resultsByTaskId[t.taskId] }));
        return jobInputs;
    }
}
