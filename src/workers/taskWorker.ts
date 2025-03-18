import { In } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Job } from '../jobs/Job';
import { getJobForTaskType } from '../jobs/JobFactory';
import { Task } from '../models/Task';
import { TaskRunner, TaskStatus } from './taskRunner';
import { Result } from '../models/Result';
import { Workflow } from '../models/Workflow';

export async function taskWorker() {
    const taskRepository = AppDataSource.getRepository(Task);
    const resultRepository = AppDataSource.getRepository(Result);
    const workflowRepository = AppDataSource.getRepository(Workflow);

    const taskRunner = new TaskRunner({
        getJobForTask(task: Task): Job {
            return getJobForTaskType(task.taskType);
        },
        getResults(resultIds) {
            return resultRepository.findBy({ resultId: In(resultIds) });
        },
        async getWorkflow(task) {
            const workflow = await workflowRepository.findOneOrFail({
                where: { workflowId: task.workflow.workflowId },
                relations: ['tasks'],
            });
            workflow?.linkTasks();
            return workflow;
        },
        saveResult(result) {
            return resultRepository.save(result);
        },
        saveTasks(...task) {
            return taskRepository.save(task);
        },
        saveWorkflow(workflow) {
            return workflowRepository.save(workflow);
        },
    });

    while (true) {
        const task = await taskRepository.findOne({
            where: { status: TaskStatus.Ready },
            relations: ['workflow', 'workflow.tasks'], // Ensure workflow is loaded
        });

        if (task) {
            try {
                task.workflow.linkTasks();
                await taskRunner.run(task);
            } catch (error) {
                console.error('Task execution failed. Task status has already been updated by TaskRunner.');
                console.error(error);
            }
        }

        // Wait before checking for the next task again
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}
