import { DefaultJob } from './Job';
import { Task } from '../models/Task';
import { Feature, Polygon } from 'geojson';
import * as turf from '@turf/turf';

export class PolygonAreaJob extends DefaultJob {
    async run(task: Task): Promise<number> {
        console.log(`Calculating polygon area for task ${task.taskId}...`);

        const inputGeometry: Feature<Polygon> = JSON.parse(task.geoJson);
        const area = turf.area(inputGeometry);

        if (area <= 0) {
            throw new Error('Invalid area');
        }

        return area;
    }
}
