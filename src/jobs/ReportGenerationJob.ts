import { DefaultJob, Job } from './Job';
import { Task } from '../models/Task';
import { Repository, In } from 'typeorm';
import { Result } from '../models/Result';
import { TaskStatus } from '../workers/taskRunner';

export class ReportGenerationJob extends DefaultJob {
    constructor(protected resultRepository: Repository<Result>) {
        super();
    }

    async run(task: Task): Promise<object> {
        console.log(`Generating report for task ${task.taskId}...`);

        const previousTasks = this.getJobDependencies(task);
        const resultIds = previousTasks.map(t => t.resultId);
        const results = await this.resultRepository.findBy({ resultId: In(resultIds) });
        const outputs = Object.fromEntries(results.map(r => [r.resultId, r.data]));

        const tasksStatusSummary = Object.fromEntries(Object.keys(TaskStatus).map(s => [s, 0]));
        previousTasks.forEach(t => {
            tasksStatusSummary[t.status] += 1;
        });

        const result = {
            workflowId: task.workflow.workflowId,
            tasks: previousTasks.map(this.digestTask.bind(this, outputs)),
            tasksStatusSummary,
        };

        return result;
    }

    /**
     * The report job is ready when all the previous tasks have finished (regardless of successfully or with errors).
     */
    override nextStatus(task: Task): TaskStatus | undefined {
        if (task.status === TaskStatus.Queued && this.getJobDependencies(task).every(t => t.isFinished())) {
            return TaskStatus.Ready;
        }
        return undefined;
    }

    /**
     * The report job implicitly depends on every task defined before.
     */
    override getJobDependencies(task: Task): Task[] {
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
