import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';

const router = Router();
const workflowRepository = AppDataSource.getRepository(Workflow);

router.get('/:id/status', async (req, res) => {
    const workflowId = req.params.id;
    const workflow = await workflowRepository.findOne({ where: { workflowId }, relations: ['tasks'] });

    if (!workflow) {
        res.status(404).json({ error: `Workflow ${workflowId} not found` });
        return;
    }

    const result = {
        workflowId,
        status: workflow.status,
        completedTasks: workflow.tasks.filter(t => t.status === 'completed').length,
        totalTasks: workflow.tasks.length,
    };

    res.json(result);
});

router.get('/:id/results', async (req, res) => {
    const workflowId = req.params.id;
    const workflow = await workflowRepository.findOne({ where: { workflowId }, relations: ['tasks'] });

    if (!workflow) {
        res.status(404).json({ error: `Workflow ${workflowId} not found` });
        return;
    }

    if (workflow.status !== 'completed') {
        res.status(400).json({ error: `Workflow ${workflowId} has not completed yet` });
        return;
    }

    const result = {
        workflowId,
        status: workflow.status,
        finalResult: workflow.finalResult,
    };

    res.json(result);
});

export default router;
