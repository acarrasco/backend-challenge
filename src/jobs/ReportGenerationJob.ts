import { DefaultJob, Job } from './Job';
import { Task } from '../models/Task';
import { Repository, In } from 'typeorm';
import { Result } from '../models/Result';
import { TaskStatus } from '../workers/taskRunner';

export interface ReportGenerationJobDependencies {
    getResults(resultIds: string[]): Promise<Result[]>;
}

export class ReportGenerationJob extends DefaultJob {
    constructor(protected deps: ReportGenerationJobDependencies) {
        super();
    }

    async run(task: Task): Promise<object> {
        console.log(`Generating report for task ${task.taskId}...`);

        const previousTasks = this.getDependencies(task);
        const resultIds = previousTasks.map(t => t.resultId).filter(x => x !== undefined);
        const results = await this.deps.getResults(resultIds);
        const outputs = Object.fromEntries(results.map(r => [r.resultId, r.data]));

        const tasksStatusSummary = Object.fromEntries(Object.values(TaskStatus).map((s: TaskStatus) => [s, 0]));
        previousTasks.forEach(t => {
            tasksStatusSummary[t.status] += 1;
        });

        const report = {
            workflowId: task.workflow.workflowId,
            tasks: previousTasks.map(this.digestTask.bind(this, outputs)),
            tasksStatusSummary,
            finalReport: JSON.stringify(outputs),
        };

        console.log({ report });

        return report;
    }

    /**
     * The report job is ready when all the previous tasks have finished (regardless of successfully or with errors).
     */
    override nextStatus(task: Task): TaskStatus | undefined {
        if (task.status === TaskStatus.Queued && this.getDependencies(task).every(t => t.isFinished())) {
            return TaskStatus.Ready;
        }
        return undefined;
    }

    /**
     * The report job implicitly depends on every task defined before.
     */
    override getDependencies(task: Task): Task[] {
        const ownStepNumber = task.stepNumber;
        const previousTasks = task.workflow.tasks.filter(t => t.stepNumber < ownStepNumber);
        return previousTasks;
    }

    digestTask(outputs: Record<string, unknown>, task: Task) {
        const output = task.resultId && outputs[task.resultId];

        return {
            taskId: task.taskId,
            type: task.taskType,
            status: task.status,
            output,
        };
    }
}
