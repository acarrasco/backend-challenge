import { DefaultJob, JobInput } from './Job';
import { Task } from '../models/Task';

export class SumJob extends DefaultJob {
    async run(task: Task, ...inputs: JobInput[]): Promise<number> {
        console.log(`Running sum for task ${task.taskId}...`, inputs);
        return inputs.reduce((a, b) => a + Number(b.result?.data || 0), 0);
    }
}
