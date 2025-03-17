import { DefaultJob } from './Job';
import { Task } from '../models/Task';
import { Result } from '../models/Result';

export class SumJob extends DefaultJob {
    async run(task: Task, ...params: Result[]): Promise<number> {
        console.log(`Running sum for task ${task.taskId}...`, params);
        return params.reduce((a, b) => a + Number(b.data), 0);
    }
}
