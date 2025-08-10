import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { executeAnsiblePlaybook } from '../services/ansibleExecutor';

const router = Router();

router.post('/execute', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { playbook, inventory, extraVars } = req.body;
    
    if (!playbook || !inventory) {
      return res.status(400).json({ error: 'Playbook and inventory are required' });
    }
    
    const result = await executeAnsiblePlaybook(playbook, inventory, extraVars);
    
    res.json(result);
  } catch (error) {
    console.error('Error executing Ansible playbook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as ansibleRoutes };