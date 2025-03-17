import { Job } from './Job';
import { DataAnalysisJob } from './DataAnalysisJob';
import { EmailNotificationJob } from './EmailNotificationJob';
import { PolygonAreaJob } from './PolygonAreaJob';
import { ReportGenerationJob } from './ReportGenerationJob';
import { AppDataSource } from '../data-source';
import { Result } from '../models/Result';

const jobMap: Record<string, () => Job> = {
    analysis: () => new DataAnalysisJob(),
    notification: () => new EmailNotificationJob(),
    area: () => new PolygonAreaJob(),
    report: () => new ReportGenerationJob(AppDataSource.getRepository(Result)),
};

export function getJobForTaskType(taskType: string): Job {
    const jobFactory = jobMap[taskType];
    if (!jobFactory) {
        throw new Error(`No job found for task type: ${taskType}`);
    }
    return jobFactory();
}
