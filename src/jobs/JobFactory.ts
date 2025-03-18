import { Job } from './Job';
import { DataAnalysisJob } from './DataAnalysisJob';
import { EmailNotificationJob } from './EmailNotificationJob';
import { PolygonAreaJob } from './PolygonAreaJob';
import { ReportGenerationJob } from './ReportGenerationJob';
import { AppDataSource } from '../data-source';
import { Result } from '../models/Result';
import { AlwaysFailJob } from './AlwaysFailJob';
import { RandomNumberJob } from './RandomNumberJob';
import { SumJob } from './SumJob';
import { In } from 'typeorm';

const jobMap: Record<string, () => Job> = {
    analysis: () => new DataAnalysisJob(),
    notification: () => new EmailNotificationJob(),
    area: () => new PolygonAreaJob(),
    report: () =>
        new ReportGenerationJob({
            async getResults(resultIds: string[]) {
                const repository = AppDataSource.getRepository(Result);
                return await repository.findBy({ resultId: In(resultIds) });
            },
        }),
    fail: () => new AlwaysFailJob(),
    random: () => new RandomNumberJob(),
    sum: () => new SumJob(),
};

export function getJobForTaskType(taskType: string): Job {
    const jobFactory = jobMap[taskType];
    if (!jobFactory) {
        throw new Error(`No job found for task type: ${taskType}`);
    }
    return jobFactory();
}
