import { DefaultJob, Job, JobInput } from './Job';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';
import { Workflow } from '../models/Workflow';

export class ReportGenerationJob extends DefaultJob {
    async run(task: Task, ...inputs: JobInput[]): Promise<object> {
        console.log(`Generating report for task ${task.taskId}...`);

        const tasksStatusSummary = ReportGenerationJob.getTasksSummary(inputs.map(i => i.task));

        const report = {
            workflowId: task.workflow.workflowId,
            tasks: inputs.map(ReportGenerationJob.digestJob),
            tasksStatusSummary,
            finalReport: ReportGenerationJob.makeFinalReport(inputs),
        };

        console.log({ report });

        return report;
    }

    /**
     * The report job is ready when all the previous tasks have finished (regardless of successfully or with errors).
     */
    override nextStatus(task: Task, workflow: Workflow): TaskStatus | undefined {
        if (task.status === TaskStatus.Queued && this.getDependencies(task, workflow).every(t => t.isFinished())) {
            return TaskStatus.Ready;
        }
        return undefined;
    }

    /**
     * The report job implicitly depends on every task defined before.
     */
    override getDependencies(task: Task, workflow: Workflow): Task[] {
        const ownStepNumber = task.stepNumber;
        const previousTasks = workflow.tasks.filter(t => t.stepNumber < ownStepNumber);
        return previousTasks;
    }

    static getTasksSummary(tasks: Task[]) {
        const tasksStatusSummary = Object.fromEntries(Object.values(TaskStatus).map((s: TaskStatus) => [s, 0]));
        tasks.forEach(task => {
            tasksStatusSummary[task.status] += 1;
        });
        return tasksStatusSummary;
    }

    static digestJob(jobInput: JobInput) {
        return {
            taskId: jobInput.task.taskId,
            stepNumber: jobInput.task.stepNumber,
            type: jobInput.task.taskType,
            status: jobInput.task.status,
            output: jobInput.result?.data || {},
        };
    }

    static finalReportSummaryItem(i: JobInput): string {
        return `#${i.task.stepNumber}.${i.task.taskType}[${i.task.status}]=${i.result?.data || '{}'}`;
    }

    static makeFinalReport(inputs: JobInput[]) {
        return inputs.map(ReportGenerationJob.finalReportSummaryItem).join('\n');
    }
}
