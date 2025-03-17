import { In } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';
import { WorkflowStatus } from '../workflows/WorkflowFactory';
import { TaskRunner, TaskStatus } from './taskRunner';

export async function taskWorker() {
    const taskRepository = AppDataSource.getRepository(Task);
    const taskRunner = new TaskRunner(taskRepository);

    while (true) {
        const task = await taskRepository.findOne({
            where: { status: TaskStatus.Ready },
            relations: ['workflow', 'workflow.tasks'], // Ensure workflow is loaded
        });

        if (task) {
            try {
                await taskRunner.run(task);
            } catch (error) {
                console.error('Task execution failed. Task status has already been updated by TaskRunner.');
                console.error(error);
            }
        }

        // Wait before checking for the next task again
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}
