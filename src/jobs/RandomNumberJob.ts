import { DefaultJob } from './Job';
import { Task } from '../models/Task';

export class RandomNumberJob extends DefaultJob {
    async run(task: Task): Promise<number> {
        return Math.random();
    }
}
