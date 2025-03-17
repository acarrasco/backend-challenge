import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { WorkflowFactory } from '../workflows/WorkflowFactory'; // Create a folder for factories if you prefer
import path from 'path';

const router = Router();
const workflowFactory = new WorkflowFactory(AppDataSource);

function sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z_-]/, '.');
}

router.post('/', async (req, res) => {
    const workflowName = (typeof req.query.workflow === 'string' && req.query.workflow) || 'example_workflow';

    const { clientId, geoJson } = req.body;
    const workflowFile = path.join(__dirname, '../workflows/', `${sanitizeFilename(workflowName)}.yml`);

    try {
        const workflow = await workflowFactory.createWorkflowFromYAML(workflowFile, clientId, JSON.stringify(geoJson));

        res.status(202).json({
            workflowId: workflow.workflowId,
            message: 'Workflow created and tasks queued from YAML definition.',
        });
    } catch (error: any) {
        console.error('Error creating workflow:', error);
        res.status(500).json({ message: 'Failed to create workflow' });
    }
});

export default router;
