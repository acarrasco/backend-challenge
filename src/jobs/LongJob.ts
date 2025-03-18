import { DefaultJob } from './Job';
import { Task } from '../models/Task';

export class LongJob extends DefaultJob {
    async run(task: Task): Promise<string> {
        await new Promise(resolve => setTimeout(resolve, 30000));
        return 'long job is long!';
    }
}
