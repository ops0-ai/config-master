"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ansibleRoutes = void 0;
const express_1 = require("express");
const ansibleExecutor_1 = require("../services/ansibleExecutor");
const router = (0, express_1.Router)();
exports.ansibleRoutes = router;
router.post('/execute', async (req, res) => {
    try {
        const { playbook, inventory, extraVars } = req.body;
        if (!playbook || !inventory) {
            return res.status(400).json({ error: 'Playbook and inventory are required' });
        }
        const result = await (0, ansibleExecutor_1.executeAnsiblePlaybook)(playbook, inventory, extraVars);
        res.json(result);
    }
    catch (error) {
        console.error('Error executing Ansible playbook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=ansible.js.map