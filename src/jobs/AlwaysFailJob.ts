import { DefaultJob } from './Job';
import { Task } from '../models/Task';

export class AlwaysFailJob extends DefaultJob {
    async run(task: Task): Promise<void> {
        throw new Error('This job always fails');
    }
}
