import { Job } from './Job';
import { DataAnalysisJob } from './DataAnalysisJob';
import { EmailNotificationJob } from './EmailNotificationJob';
import { PolygonAreaJob } from './PolygonAreaJob';
import { ReportGenerationJob } from './ReportGenerationJob';
import { AlwaysFailJob } from './AlwaysFailJob';
import { RandomNumberJob } from './RandomNumberJob';
import { SumJob } from './SumJob';
import { LongJob } from './LongJob';

const jobMap: Record<string, () => Job> = {
    analysis: () => new DataAnalysisJob(),
    notification: () => new EmailNotificationJob(),
    area: () => new PolygonAreaJob(),
    report: () => new ReportGenerationJob(),
    fail: () => new AlwaysFailJob(),
    random: () => new RandomNumberJob(),
    sum: () => new SumJob(),
    long: () => new LongJob(),
};

export function getJobForTaskType(taskType: string): Job {
    const jobFactory = jobMap[taskType];
    if (!jobFactory) {
        throw new Error(`No job found for task type: ${taskType}`);
    }
    return jobFactory();
}
